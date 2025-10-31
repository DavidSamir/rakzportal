#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RAKEZ / Salesforce Visualforce document fetcher
-----------------------------------------------

Usage:
  python3 main.py --code <DOCUMENT_CODE> -o output.pdf [--debug]

What it does:
  * Loads the Verify Document page (Visualforce)
  * Submits the form as an A4J (RichFaces) AJAX request, which returns a
    `<partial-response>` XML. We parse each `<update id="…">` block to find
    either a base64-embedded PDF (`pdf_base64Str='...'`) or a direct
    Shepherd/PDF URL to download.
  * Falls back to several HTML POST modes if needed.
  * Writes helpful debug artifacts under ./debug when --debug is set.

Tested against the responses you shared (Oct 31, 2025).
"""

import argparse
import os
import re
import sys
import time
from base64 import b64decode
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

AUTH_PAGE = "https://rakez.my.salesforce-sites.com/Auth/VerifyDocument"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)

DEBUG_DIR = os.path.join(os.getcwd(), "debug")


def try_decode_pdf_b64(data):
    """Return decoded bytes or None if input is not valid base64."""
    if not data:
        return None
    data = re.sub(r"\s+", "", data.strip())
    missing = len(data) % 4
    if missing:
        data += "=" * (4 - missing)
    try:
        return b64decode(data)
    except Exception:
        return None


def write_debug(path, content, mode="w"):
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if isinstance(content, (bytes, bytearray)):
            with open(path, "wb") as f:
                f.write(content)
        else:
            with open(path, mode, encoding="utf-8", errors="ignore") as f:
                f.write(content)
    except Exception:
        pass


def get_initial_form(session, debug=False):
    """GET the page and scrape the form action + hidden fields.
    Returns (action_url, hidden_fields, full_html, referer_url)
    """
    headers = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml"}
    r = session.get(AUTH_PAGE, headers=headers, timeout=60)
    if debug:
        print(f"[DEBUG] GET page -> {r.status_code} {r.headers.get('Content-Type')} len={len(r.text)}")
        write_debug(os.path.join(DEBUG_DIR, "get_verify_doc.html"), r.text, "w")

    referer_url = r.url
    soup = BeautifulSoup(r.text, "html.parser")
    form = soup.find("form", id=re.compile(r"VerifyDocPG:documentform"))
    if not form:
        raise RuntimeError("Could not locate main form on page.")

    action = form.get("action") or AUTH_PAGE
    if not action.startswith("http"):
        action = urljoin(AUTH_PAGE, action)

    fields = {}
    for inp in form.find_all("input"):
        name = inp.get("name")
        value = inp.get("value", "")
        if name:
            fields[name] = value

    # Visualforce keeps its viewstate fields outside the <form>; capture them too
    for hidden in soup.select("input[type='hidden']"):
        name = hidden.get("name")
        if not name or name in fields:
            continue
        fields[name] = hidden.get("value", "")

    return action, fields, r.text, referer_url


def base_payload_from_fields(fields, code):
    payload = dict(fields)
    # The page uses these keys for the doc reference input & submit
    payload["VerifyDocPG:documentform"] = "VerifyDocPG:documentform"
    payload["VerifyDocPG:documentform:docReference"] = code
    return payload


# ------------- A4J partial response helpers -------------

def parse_a4j_partial(xml_text):
    """Returns dict[id] = inner_html from <update id="…"> blocks.
    Safe even if text isn't XML.
    """
    updates = {}
    if not xml_text:
        return updates
    try:
        root = ET.fromstring(xml_text)
        for upd in root.findall(".//update"):
            uid = upd.get("id") or ""
            html = upd.text or ""
            updates[uid] = html
    except ET.ParseError:
        pass
    return updates


def extract_message_from_html(html):
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    # try the explicit messages region first
    region = soup.find(id=re.compile(r"VerifyDocPG:documentform:j_id21"))
    if region:
        txt = region.get_text(" ", strip=True)
        if txt:
            return txt
    # pick up bootstrap alerts
    alert = soup.select_one(".alert, .alert-danger, .alert-warning, .alert-info, .alert-success")
    if alert:
        t = alert.get_text(" ", strip=True)
        if t:
            return t
    # fallback: hunt for common error strings
    for div in soup.find_all("div"):
        t = div.get_text(" ", strip=True)
        if t and any(w in t.lower() for w in ("error", "invalid", "not found", "no record")):
            return t
    return None


def extract_pdf_from_any(*texts):
    """Scan multiple strings for either embedded base64 PDF or a direct PDF/Shepherd URL.
    Returns tuple(pdf_bytes_or_None, pdf_url_or_None)
    """
    for text in texts:
        if not text:
            continue
        # Embedded base64 PDF set by script: pdf_base64Str='...'
        m = re.search(r'pdf_base64Str\s*=\s*["\']([^"\']+)["\']', text)
        if m and m.group(1).strip():
            b64 = m.group(1)
            # Often prefixed with data:application/pdf;base64,
            b64 = re.sub(r'^[^,]+,', '', b64)
            pdf = try_decode_pdf_b64(b64)
            if pdf:
                return pdf, None
        # Direct data URI on download link
        m = re.search(r'data:application/pdf(?:;base64)?,([^"\'>\s]+)', text, re.I)
        if m:
            pdf = try_decode_pdf_b64(m.group(1))
            if pdf:
                return pdf, None
        # Direct shepherd or pdf URL
        m = (
            re.search(r'https?://[^"\']+\.pdf\b', text, re.I)
            or re.search(r'https?://[^"\']+/sfc/servlet\.shepherd/[^"\']+', text, re.I)
        )
        if m:
            return None, m.group(0)
    return None, None


# ------------- POST modes -------------

def post_like_click(session, action_url, base_payload, referer, debug=False):
    """Emulate clicking the Search button as an A4J ajax submit."""
    payload = dict(base_payload)
    payload["VerifyDocPG:documentform:j_id7"] = "VerifyDocPG:documentform:j_id7"
    payload["AJAXREQUEST"] = "_viewRoot"
    payload["AJAX:EVENTS_COUNT"] = payload.get("AJAX:EVENTS_COUNT", "1")
    payload["similarityGroupingId"] = "VerifyDocPG:documentform:j_id7"
    payload["org.ajax4jsf.ajax"] = "true"  # some RichFaces deployments require this flag

    headers = {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "text/xml,application/xml,text/html,*/*;q=0.8",
        "Referer": referer,
        "X-Requested-With": "XMLHttpRequest",
        "Faces-Request": "partial/ajax",
    }
    r = session.post(action_url, data=payload, headers=headers, timeout=60, allow_redirects=True)
    if debug:
        write_debug(os.path.join(DEBUG_DIR, "post_like_click.body.xml"), r.text, "w")
        write_debug(os.path.join(DEBUG_DIR, "post_like_click.headers.txt"),
                    "\n".join(f"{k}: {v}" for k, v in r.headers.items()), "w")
        print(f"[DEBUG] post_like_click -> {r.status_code} {r.headers.get('Content-Type')} len={len(r.text)}")
    return r


def post_plain(session, action_url, base_payload, referer, debug=False):
    headers = {"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Referer": referer}
    r = session.post(action_url, data=base_payload, headers=headers, timeout=60)
    if debug:
        write_debug(os.path.join(DEBUG_DIR, "post_plain.html"), r.text, "w")
        print(f"[DEBUG] POST mode 1 'plain' -> {r.status_code} {r.headers.get('Content-Type')}; len={len(r.text)}")
    return r


def post_ajax_param(session, action_url, base_payload, referer, debug=False):
    payload = dict(base_payload)
    payload["AJAXREQUEST"] = "_viewRoot"
    headers = {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "text/xml,application/xml,text/html,*/*;q=0.8",
        "Referer": referer,
    }
    r = session.post(action_url, data=payload, headers=headers, timeout=60)
    if debug:
        write_debug(os.path.join(DEBUG_DIR, "post_ajax_param.html"), r.text, "w")
        print(f"[DEBUG] POST mode 2 'ajax_param' -> {r.status_code} {r.headers.get('Content-Type')}; len={len(r.text)}")
    return r


def post_faces_header(session, action_url, base_payload, referer, debug=False):
    payload = dict(base_payload)
    headers = {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "text/xml,application/xml,text/html,*/*;q=0.8",
        "Referer": referer,
        "Faces-Request": "partial/ajax",
    }
    r = session.post(action_url, data=payload, headers=headers, timeout=60)
    if debug:
        write_debug(os.path.join(DEBUG_DIR, "post_faces_header.html"), r.text, "w")
        print(f"[DEBUG] POST mode 3 'faces_header' -> {r.status_code} {r.headers.get('Content-Type')}; len={len(r.text)}")
    return r


# ------------- Fetch logic -------------

def try_extract_and_save(texts, out_path, session=None, debug=False, referer=AUTH_PAGE):
    pdf_bytes, pdf_url = extract_pdf_from_any(*texts)
    if pdf_bytes:
        with open(out_path, "wb") as f:
            f.write(pdf_bytes)
        return True, None
    if pdf_url and session is not None:
        try:
            r = session.get(pdf_url, headers={"User-Agent": UA, "Referer": referer}, timeout=60)
            if r.status_code == 200 and r.headers.get("Content-Type", "").lower().startswith("application/pdf"):
                with open(out_path, "wb") as f:
                    f.write(r.content)
                return True, None
            # Some shepherd endpoints require one redirect hop
            if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("Location"):
                r2 = session.get(r.headers["Location"], headers={"User-Agent": UA, "Referer": referer}, timeout=60)
                if r2.status_code == 200 and r2.headers.get("Content-Type", "").lower().startswith("application/pdf"):
                    with open(out_path, "wb") as f:
                        f.write(r2.content)
                    return True, None
        except Exception as e:
            return False, f"Download error: {e}"
    return False, None


def fetch_pdf(code, output, debug=False):
    s = requests.Session()
    s.headers.update({"User-Agent": UA})

    action, fields, page_html, referer_url = get_initial_form(s, debug=debug)
    payload = base_payload_from_fields(fields, code)
    referer = referer_url or action or AUTH_PAGE

    # Preferred: emulate the button click over A4J
    r_click = post_like_click(s, action, payload, referer=referer, debug=debug)
    updates = parse_a4j_partial(r_click.text)
    if debug and updates:
        write_debug(os.path.join(DEBUG_DIR, "partial_updates.ids.txt"), "\n".join(updates.keys()), "w")
        for uid, html in updates.items():
            safe = uid.replace(":", "_") or "update"
            write_debug(os.path.join(DEBUG_DIR, f"partial_update__{safe}.html"), html, "w")

    msg = extract_message_from_html(" ".join(updates.values())) or extract_message_from_html(r_click.text)
    if msg:
        print(f"[SERVER MESSAGE] {msg}")

    ok, err = try_extract_and_save([updates.get("VerifyDocPG:docviewer", ""), *updates.values(), r_click.text], output, session=s, debug=debug, referer=referer)
    if ok:
        return True

    # Fallback: plain post
    r1 = post_plain(s, action, payload, referer=referer, debug=debug)
    msg = extract_message_from_html(r1.text) or msg
    ok, err = try_extract_and_save([r1.text], output, session=s, debug=debug, referer=referer)
    if ok:
        return True

    # Fallback: ajax_param
    r2 = post_ajax_param(s, action, payload, referer=referer, debug=debug)
    updates2 = parse_a4j_partial(r2.text)
    if updates2:
        msg = extract_message_from_html(" ".join(updates2.values())) or msg
    ok, err = try_extract_and_save([" ".join(updates2.values()), r2.text], output, session=s, debug=debug, referer=referer)
    if ok:
        return True

    # Fallback: faces header only
    r3 = post_faces_header(s, action, payload, referer=referer, debug=debug)
    updates3 = parse_a4j_partial(r3.text)
    if updates3:
        msg = extract_message_from_html(" ".join(updates3.values())) or msg
    ok, err = try_extract_and_save([" ".join(updates3.values()), r3.text], output, session=s, debug=debug, referer=referer)
    if ok:
        return True

    if debug:
        # Save whatever we have at the end for forensics
        write_debug(os.path.join(DEBUG_DIR, "final_plain_or_partial_dump.txt"),
                    "\n\n".join([
                        "--- CLICK PARTIAL ---\n" + r_click.text,
                        "--- PLAIN ---\n" + r1.text,
                        "--- AJAX_PARAM ---\n" + r2.text,
                        "--- FACES_HEADER ---\n" + r3.text,
                    ]),
                    "w")

    if msg:
        print("Error: No PDF found in response. Server message above may explain.")
    else:
        print("Error: No PDF found in response after all POST modes. Likely an invalid code or the page changed.")
    return False


def parse_args():
    p = argparse.ArgumentParser(description="Fetch RAKEZ verified document as PDF")
    p.add_argument("--code", required=True, help="Document reference code to verify")
    p.add_argument("-o", "--output", required=True, help="Output PDF filename")
    p.add_argument("--debug", action="store_true", help="Write verbose debug artifacts to ./debug")
    return p.parse_args()


def main():
    args = parse_args()
    success = fetch_pdf(args.code, args.output, debug=args.debug)
    if success:
        print(f"Saved PDF to {args.output}")
        sys.exit(0)
    sys.exit(2)


if __name__ == "__main__":
    main()
