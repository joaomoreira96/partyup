import type { PartyUpSDK } from "@/lib/partyup-sdk/client";
import {
  PARTYUP_SDK_SOURCE,
  type PartyUpSdkBridgeMethod,
  type PartyUpSdkInitPayload,
  type PartyUpSdkMessage,
  type PartyUpSdkResponsePayload,
  parsePartyUpSdkMessage,
} from "@/lib/partyup-sdk/protocol";
import { PartyUpSdkError } from "@/lib/partyup-sdk/types";

export type IframeSdkBridgeOptions = {
  iframe: HTMLIFrameElement;
  allowedOrigin: string;
  init: PartyUpSdkInitPayload;
  sdk: PartyUpSDK;
  onReady?: () => void;
  onChildEvent?: (type: string, payload?: Record<string, unknown>) => void;
  onBridgeError?: (message: string) => void;
};

const NOT_IMPLEMENTED: Record<string, string> = {
  createRoom: "Multiplayer estará disponível numa fase futura.",
  joinRoom: "Multiplayer estará disponível numa fase futura.",
  sendRoomEvent: "Multiplayer estará disponível numa fase futura.",
};

/** Sandboxed iframe (sem allow-same-origin) reporta origin "null". */
function isAllowedIframeOrigin(eventOrigin: string, allowedOrigin: string): boolean {
  return eventOrigin === allowedOrigin || eventOrigin === "null";
}

function postToIframe(iframe: HTMLIFrameElement, message: PartyUpSdkMessage) {
  // Opaque origin no sandbox exige targetOrigin "*"
  iframe.contentWindow?.postMessage(message, "*");
}

/** Pede ao SDK no iframe que reenvie READY (útil após load ou race). */
export function pingIframeSdk(iframe: HTMLIFrameElement) {
  postToIframe(iframe, {
    source: PARTYUP_SDK_SOURCE,
    type: "PING",
    payload: {},
  });
}

function buildResponse(
  requestId: string,
  payload: PartyUpSdkResponsePayload
): PartyUpSdkMessage {
  return {
    source: PARTYUP_SDK_SOURCE,
    type: "RESPONSE",
    requestId,
    payload: payload as unknown as Record<string, unknown>,
  };
}

async function dispatchBridgeMethod(
  method: PartyUpSdkBridgeMethod,
  args: Record<string, unknown> | undefined,
  sdk: PartyUpSDK,
  init: PartyUpSdkInitPayload
): Promise<unknown> {
  switch (method) {
    case "startGame":
      return sdk.startGame();
    case "endGame":
      return sdk.endGame(
        (args ?? {}) as unknown as Parameters<PartyUpSDK["endGame"]>[0]
      );
    case "submitScore":
      return sdk.submitScore(
        (args ?? {}) as unknown as Parameters<PartyUpSDK["submitScore"]>[0]
      );
    case "reportScore": {
      const score = Number(args?.score);
      sdk.reportScore(score);
      return undefined;
    }
    case "getCurrentUser":
      return sdk.getCurrentUser();
    case "getCurrentLanguage":
      return init.language;
    case "getCurrentGame":
      return init.game;
    case "getCurrentRoom":
      return sdk.getCurrentRoom() ?? init.room ?? null;
    case "leaveRoom":
      return sdk.leaveRoom();
    case "createRoom":
    case "joinRoom":
    case "sendRoomEvent":
      throw new PartyUpSdkError(
        `${method}_not_implemented`,
        "ROOM_FORBIDDEN",
        NOT_IMPLEMENTED[method] ?? "Funcionalidade ainda não disponível."
      );
    default:
      throw new PartyUpSdkError(
        `unknown_method_${method}`,
        "UNKNOWN",
        "Método SDK desconhecido."
      );
  }
}

function errorPayload(err: unknown): PartyUpSdkResponsePayload {
  if (err instanceof PartyUpSdkError) {
    return {
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        userMessage: err.userMessage,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "UNKNOWN",
      message: err instanceof Error ? err.message : String(err),
      userMessage: "Ocorreu um erro na comunicação com o jogo.",
    },
  };
}

/** Ponte postMessage entre iframe e PartyUpSDK (parent). */
export function attachIframeSdkBridge(
  options: IframeSdkBridgeOptions
): () => void {
  const { iframe, allowedOrigin, init, sdk, onReady, onChildEvent, onBridgeError } =
    options;
  let handshakeDone = false;

  async function handleMessage(event: MessageEvent) {
    if (event.source !== iframe.contentWindow) return;

    const originAllowed = isAllowedIframeOrigin(event.origin, allowedOrigin);

    // #region agent log
    fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'iframe-bridge.ts:handleMessage',message:'iframe message received',data:{eventOrigin:event.origin,allowedOrigin,originAllowed,type:typeof event.data==='object'&&event.data!==null?(event.data as {type?:string;source?:string}).type:null,source:typeof event.data==='object'&&event.data!==null?(event.data as {source?:string}).source:null},timestamp:Date.now(),hypothesisId:'H-C-origin',runId:'post-fix'})}).catch(()=>{});
    // #endregion

    if (!originAllowed) return;

    const message = parsePartyUpSdkMessage(event.data);
    if (!message) return;

    if (message.type === "READY") {
      // #region agent log
      fetch('http://127.0.0.1:7623/ingest/ede92153-62b3-4507-ad26-5bd6e9c78294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e1fc4'},body:JSON.stringify({sessionId:'5e1fc4',location:'iframe-bridge.ts:READY',message:'READY accepted, sending INIT',data:{handshakeDone},timestamp:Date.now(),hypothesisId:'H-D-handshake'})}).catch(()=>{});
      // #endregion
      if (handshakeDone) return;
      handshakeDone = true;
      postToIframe(iframe, {
        source: PARTYUP_SDK_SOURCE,
        type: "INIT",
        payload: init as unknown as Record<string, unknown>,
      });
      onReady?.();
      return;
    }

    if (message.type === "EVENT") {
      const eventType = String(message.payload?.eventType ?? message.payload?.type ?? "");
      onChildEvent?.(eventType, message.payload);
      return;
    }

    if (message.type !== "CALL" || !message.requestId) return;

    const method = String(message.payload?.method ?? "") as PartyUpSdkBridgeMethod;
    const args = message.payload?.args as Record<string, unknown> | undefined;

    try {
      const result = await dispatchBridgeMethod(method, args, sdk, init);
      postToIframe(
        iframe,
        buildResponse(message.requestId, { ok: true, result })
      );
    } catch (err) {
      const payload = errorPayload(err);
      postToIframe(
        iframe,
        buildResponse(message.requestId, payload)
      );
      if (payload.error?.userMessage) {
        onBridgeError?.(payload.error.userMessage);
      }
    }
  }

  window.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}
