/* ==========================================================================
   CPOR Industry Engagement — Documentation Site
   Site behavior: intro splash, mobile nav, video placeholders
   ========================================================================== */
(function () {
  "use strict";

  // ----- Intro splash (landing page only) -----
  function initSplash() {
    var splash = document.getElementById("splash");
    if (!splash) return;
    // Respect users who have already seen it this session
    if (sessionStorage.getItem("cporSplashSeen")) {
      splash.parentNode.removeChild(splash);
      return;
    }
    window.setTimeout(function () {
      splash.classList.add("hide");
      sessionStorage.setItem("cporSplashSeen", "1");
      window.setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 700);
    }, 1700);
  }

  // ----- Mobile nav toggle -----
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".site-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
      var expanded = nav.classList.contains("open");
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  // ----- Video placeholders -----
  // Each .video element carries data-video (future source) and shows a notice
  // until a real recording is wired in.
  function initVideos() {
    var videos = document.querySelectorAll(".video");
    Array.prototype.forEach.call(videos, function (v) {
      v.setAttribute("role", "button");
      v.setAttribute("tabindex", "0");
      function activate() {
        var src = v.getAttribute("data-video");
        var title = v.getAttribute("data-title") || "Demo";
        if (src) {
          // When a real video URL is provided, swap in a player.
          var frame = document.createElement("video");
          frame.src = src;
          frame.controls = true;
          frame.autoplay = true;
          frame.style.position = "absolute";
          frame.style.inset = "0";
          frame.style.width = "100%";
          frame.style.height = "100%";
          frame.style.objectFit = "cover";
          v.innerHTML = "";
          v.appendChild(frame);
        } else {
          v.classList.add("pending");
          showToast("Demo video \u201C" + title + "\u201D will be available here.");
        }
      }
      v.addEventListener("click", activate);
      v.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });
  }

  function showToast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);" +
      "background:#171717;color:#fff;padding:12px 20px;border-radius:4px;" +
      "font-family:inherit;font-size:.9rem;z-index:3000;box-shadow:0 6px 18px rgba(0,0,0,.25);" +
      "opacity:0;transition:opacity .25s;";
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = "1"; });
    window.setTimeout(function () {
      t.style.opacity = "0";
      window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, 2600);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSplash();
    initNav();
    initVideos();
  });
})();
