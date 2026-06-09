/**
 * PartyUp SDK — cliente iframe (Fase 3)
 *
 * Incluir no index.html do jogo publicado:
 *   <script src="https://SEU_DOMINIO/partyup-sdk.js"></script>
 *
 * Ou copiar este ficheiro para build/partyup-sdk.js no ZIP.
 */
(function () {
  "use strict";

  var SOURCE = "partyup-sdk";
  var initData = null;
  var readyPromise = null;
  var readyResolve = null;
  var pending = Object.create(null);
  var sessionId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());

  function ensureReadyPromise() {
    if (!readyPromise) {
      readyPromise = new Promise(function (resolve) {
        readyResolve = resolve;
      });
    }
    return readyPromise;
  }

  function post(type, payload, requestId) {
    var msg = { source: SOURCE, type: type, payload: payload || {} };
    if (requestId) msg.requestId = requestId;
    window.parent.postMessage(msg, "*");
  }

  function emitEvent(eventType, payload) {
    post("EVENT", Object.assign({ eventType: eventType }, payload || {}));
  }

  function call(method, args) {
    return new Promise(function (resolve, reject) {
      var requestId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()) + Math.random();

      pending[requestId] = { resolve: resolve, reject: reject };

      post(
        "CALL",
        {
          method: method,
          args: args || {},
        },
        requestId
      );

      setTimeout(function () {
        if (pending[requestId]) {
          delete pending[requestId];
          reject(new Error("SDK request timeout: " + method));
        }
      }, 30000);
    });
  }

  function sdkError(code, message, userMessage) {
    var err = new Error(message || code);
    err.code = code;
    err.userMessage = userMessage || message || code;
    err.name = "PartyUpSdkError";
    return err;
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== SOURCE) return;

    if (data.type === "INIT") {
      initData = data.payload || null;
      if (initData && initData.session && !initData.session.id) {
        initData.session.id = sessionId;
      }
      if (readyResolve) readyResolve(initData);
      emitEvent("GAME_READY");
      return;
    }

    if (data.type === "RESPONSE" && data.requestId && pending[data.requestId]) {
      var handlers = pending[data.requestId];
      delete pending[data.requestId];
      var payload = data.payload || {};

      if (payload.ok) {
        handlers.resolve(payload.result);
      } else {
        var errInfo = payload.error || {};
        handlers.reject(
          sdkError(
            errInfo.code || "UNKNOWN",
            errInfo.message || "request_failed",
            errInfo.userMessage
          )
        );
      }
      return;
    }

    if (data.type === "ERROR") {
      var msg = (data.payload && data.payload.message) || "platform_error";
      console.error("[PartyUp SDK]", msg);
    }
  });

  var PartyUp = {
    /** Aguarda INIT da plataforma após enviar READY. */
    ready: function () {
      ensureReadyPromise();
      post("READY", { sessionId: sessionId });
      return readyPromise;
    },

    getSessionId: function () {
      return (initData && initData.session && initData.session.id) || sessionId;
    },

    startGame: function () {
      return call("startGame").then(function () {
        emitEvent("GAME_STARTED");
      });
    },

    endGame: function (payload) {
      var body =
        typeof payload === "object" && payload !== null
          ? payload
          : { score: Number(payload) || 0, durationMs: 0 };

      return call("endGame", body).then(function (result) {
        emitEvent("GAME_FINISHED", { score: body.score });
        return result;
      });
    },

    submitScore: function (score) {
      var payload =
        typeof score === "number" ? { score: score } : score || { score: 0 };

      return call("submitScore", payload).then(function () {
        emitEvent("SCORE_SUBMITTED", { score: payload.score });
      });
    },

    reportScore: function (score) {
      return call("reportScore", { score: Number(score) || 0 });
    },

    getCurrentUser: function () {
      if (initData && initData.user) return Promise.resolve(initData.user);
      return call("getCurrentUser");
    },

    getCurrentLanguage: function () {
      if (initData && initData.language) return Promise.resolve(initData.language);
      return call("getCurrentLanguage");
    },

    getCurrentGame: function () {
      if (initData && initData.game) return Promise.resolve(initData.game);
      return call("getCurrentGame");
    },

    getCurrentRoom: function () {
      if (initData && initData.room) return Promise.resolve(initData.room);
      return call("getCurrentRoom");
    },

    createRoom: function () {
      return call("createRoom");
    },

    joinRoom: function () {
      return call("joinRoom");
    },

    leaveRoom: function () {
      return call("leaveRoom").then(function () {
        emitEvent("ROOM_LEAVE");
      });
    },

    sendRoomEvent: function (payload) {
      return call("sendRoomEvent", payload || {});
    },

    emit: emitEvent,
  };

  window.PartyUp = PartyUp;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      PartyUp.ready();
    });
  } else {
    PartyUp.ready();
  }
})();
