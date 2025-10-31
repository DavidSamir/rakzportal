import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { load as loadHtml } from "cheerio";
import { XMLParser } from "fast-xml-parser";

const AUTH_PAGE = "https://rakez.my.salesforce-sites.com/Auth/VerifyDocument";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  trimValues: false,
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tryDecodePdfBase64(data) {
  if (!data) return null;
  const stripped = data.replace(/\s+/g, "");
  const missing = stripped.length % 4;
  const padded = missing ? stripped + "=".repeat(4 - missing) : stripped;
  try {
    return Buffer.from(padded, "base64");
  } catch (error) {
    return null;
  }
}

function extractPdfFromAny(...texts) {
  for (const raw of texts) {
    if (!raw) continue;
    const text = String(raw);

    const embedded = text.match(/pdf_base64Str\s*=\s*["']([^"']+)["']/);
    if (embedded && embedded[1]) {
      const cleaned = embedded[1].replace(/^[^,]+,/, "");
      const bytes = tryDecodePdfBase64(cleaned);
      if (bytes) return { pdfBytes: bytes };
    }

    const dataUri = text.match(/data:application\/pdf(?:;base64)?,([^"'>\s]+)/i);
    if (dataUri && dataUri[1]) {
      const bytes = tryDecodePdfBase64(dataUri[1]);
      if (bytes) return { pdfBytes: bytes };
    }

    const urlMatch =
      text.match(/https?:\/\/[^\s"'<>]+\.pdf\b/i) ||
      text.match(/https?:\/\/[^\s"'<>]+\/sfc\/servlet\.shepherd\/[^\s"'<>]+/i);
    if (urlMatch && urlMatch[0]) {
      return { pdfUrl: urlMatch[0] };
    }
  }

  return {};
}

function parseA4JPartial(xmlText) {
  if (!xmlText) return {};
  try {
    const parsed = xmlParser.parse(xmlText);
    const updatesNode = parsed?.["partial-response"]?.changes?.update;
    if (!updatesNode) return {};
    const updatesArray = Array.isArray(updatesNode) ? updatesNode : [updatesNode];
    return updatesArray.reduce((acc, update) => {
      if (!update) return acc;
      const id = update.id || update["@_id"];
      const html = typeof update === "string" ? update : update.text || update["#text"] || "";
      if (id) {
        acc[id] = html;
      }
      return acc;
    }, {});
  } catch (error) {
    return {};
  }
}

function extractMessageFromHtml(html) {
  if (!html) return null;
  const $ = loadHtml(html);
  const region = $("#VerifyDocPG\\\\:documentform\\\\:j_id21").first();
  if (region.length) {
    const text = region.text().trim();
    if (text) return text;
  }
  const alert = $(".alert, .alert-danger, .alert-warning, .alert-info, .alert-success").first();
  if (alert.length) {
    const text = alert.text().trim();
    if (text) return text;
  }
  let fallback = null;
  $("div").each((_, element) => {
    if (fallback) return;
    const text = $(element).text().trim();
    if (!text) return;
    const lowered = text.toLowerCase();
    if (lowered.includes("error") || lowered.includes("invalid") || lowered.includes("not found") || lowered.includes("no record")) {
      fallback = text;
    }
  });
  return fallback;
}

function asFormEncoded(payload) {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    params.append(key, value ?? "");
  });
  return params.toString();
}

async function getInitialForm(client) {
  const headers = { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" };
  const response = await client.get(AUTH_PAGE, { headers });
  const html = response.data;
  const referer = response.request?.res?.responseUrl || AUTH_PAGE;

  const $ = loadHtml(html);
  const form = $("form[id*='VerifyDocPG:documentform']").first();
  if (!form.length) {
    throw new Error("Could not locate main form on page.");
  }

  let action = form.attr("action") || AUTH_PAGE;
  if (!/^https?:\/\//i.test(action)) {
    action = new URL(action, AUTH_PAGE).toString();
  }

  const fields = {};
  form.find("input").each((_, element) => {
    const name = $(element).attr("name");
    if (!name) return;
    fields[name] = $(element).attr("value") ?? "";
  });

  $("input[type='hidden']").each((_, element) => {
    const name = $(element).attr("name");
    if (!name || fields.hasOwnProperty(name)) return;
    fields[name] = $(element).attr("value") ?? "";
  });

  return { action, fields, referer };
}

function basePayloadFromFields(fields, code) {
  return {
    ...fields,
    "VerifyDocPG:documentform": "VerifyDocPG:documentform",
    "VerifyDocPG:documentform:docReference": code,
  };
}

async function postLikeClick(client, actionUrl, basePayload, referer) {
  const payload = {
    ...basePayload,
    "VerifyDocPG:documentform:j_id7": "VerifyDocPG:documentform:j_id7",
    AJAXREQUEST: "_viewRoot",
    "AJAX:EVENTS_COUNT": basePayload["AJAX:EVENTS_COUNT"] || "1",
    similarityGroupingId: "VerifyDocPG:documentform:j_id7",
    "org.ajax4jsf.ajax": "true",
  };

  const headers = {
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Accept: "text/xml,application/xml,text/html,*/*;q=0.8",
    Referer: referer,
    "X-Requested-With": "XMLHttpRequest",
    "Faces-Request": "partial/ajax",
  };

  return client.post(actionUrl, asFormEncoded(payload), { headers, validateStatus: () => true });
}

async function postPlain(client, actionUrl, basePayload, referer) {
  const headers = {
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded",
    Referer: referer,
  };
  return client.post(actionUrl, asFormEncoded(basePayload), { headers, validateStatus: () => true });
}

async function postAjaxParam(client, actionUrl, basePayload, referer) {
  const payload = {
    ...basePayload,
    AJAXREQUEST: "_viewRoot",
  };

  const headers = {
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Accept: "text/xml,application/xml,text/html,*/*;q=0.8",
    Referer: referer,
  };

  return client.post(actionUrl, asFormEncoded(payload), { headers, validateStatus: () => true });
}

async function postFacesHeader(client, actionUrl, basePayload, referer) {
  const headers = {
    "User-Agent": UA,
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Accept: "text/xml,application/xml,text/html,*/*;q=0.8",
    Referer: referer,
    "Faces-Request": "partial/ajax",
  };

  return client.post(actionUrl, asFormEncoded(basePayload), { headers, validateStatus: () => true });
}

async function tryExtractAndFetch(client, texts, referer) {
  const { pdfBytes, pdfUrl } = extractPdfFromAny(...texts);
  if (pdfBytes) {
    return { ok: true, buffer: pdfBytes };
  }
  if (pdfUrl) {
    const response = await client.get(pdfUrl, {
      headers: { "User-Agent": UA, Referer: referer },
      responseType: "arraybuffer",
      validateStatus: () => true,
    });
    const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
    if (response.status === 200 && contentType.startsWith("application/pdf")) {
      return { ok: true, buffer: Buffer.from(response.data) };
    }
    if (
      [301, 302, 303, 307, 308].includes(response.status) &&
      response.headers?.location
    ) {
      const redirected = await client.get(response.headers.location, {
        headers: { "User-Agent": UA, Referer: referer },
        responseType: "arraybuffer",
        validateStatus: () => true,
      });
      const redirectedType = String(redirected.headers?.["content-type"] || "").toLowerCase();
      if (redirected.status === 200 && redirectedType.startsWith("application/pdf")) {
        return { ok: true, buffer: Buffer.from(redirected.data) };
      }
    }
    return { ok: false, error: "Failed to download PDF from provided URL." };
  }
  return { ok: false };
}

function joinUpdates(updates) {
  return Object.values(updates || {}).join(" ");
}

export async function GET(request, { params }) {
  const code = params?.code;
  if (!code) {
    return new Response("Missing document code.", { status: 400 });
  }

  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      headers: { "User-Agent": UA },
      maxRedirects: 5,
    }),
  );
  client.defaults.jar = jar;
  client.defaults.withCredentials = true;

  try {
    const { action, fields, referer } = await getInitialForm(client);
    const payload = basePayloadFromFields(fields, code);

    const clickResponse = await postLikeClick(client, action, payload, referer);
    const clickUpdates = parseA4JPartial(clickResponse.data);
    const combinedClick = joinUpdates(clickUpdates) + clickResponse.data;
    const firstAttempt = await tryExtractAndFetch(
      client,
      [clickUpdates["VerifyDocPG:docviewer"], ...Object.values(clickUpdates), clickResponse.data],
      referer,
    );
    if (firstAttempt.ok) {
      return new Response(firstAttempt.buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="document.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }

    const plainResponse = await postPlain(client, action, payload, referer);
    const secondAttempt = await tryExtractAndFetch(client, [plainResponse.data], referer);
    if (secondAttempt.ok) {
      return new Response(secondAttempt.buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="document.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }

    const ajaxResponse = await postAjaxParam(client, action, payload, referer);
    const ajaxUpdates = parseA4JPartial(ajaxResponse.data);
    const thirdAttempt = await tryExtractAndFetch(
      client,
      [joinUpdates(ajaxUpdates), ajaxResponse.data],
      referer,
    );
    if (thirdAttempt.ok) {
      return new Response(thirdAttempt.buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="document.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }

    const facesResponse = await postFacesHeader(client, action, payload, referer);
    const facesUpdates = parseA4JPartial(facesResponse.data);
    const fourthAttempt = await tryExtractAndFetch(
      client,
      [joinUpdates(facesUpdates), facesResponse.data],
      referer,
    );
    if (fourthAttempt.ok) {
      return new Response(fourthAttempt.buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="document.pdf"',
          "Cache-Control": "no-store",
        },
      });
    }

    const message =
      extractMessageFromHtml(combinedClick) ||
      extractMessageFromHtml(plainResponse.data) ||
      extractMessageFromHtml(joinUpdates(ajaxUpdates)) ||
      extractMessageFromHtml(joinUpdates(facesUpdates));

    const errorBody = message ? `No PDF found. Server said: ${message}` : "No PDF found for the provided code.";
    return new Response(errorBody, { status: 404 });
  } catch (error) {
    console.error("[pdf route] failed to fetch pdf", error);
    return new Response("Failed to fetch document. Please try again later.", { status: 500 });
  }
}
