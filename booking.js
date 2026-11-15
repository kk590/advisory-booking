/* Restore booking logic from last good commit and fix Download Receipt button id */
(function () {
  var s = document.createElement("script");
  s.src = "https://raw.githubusercontent.com/kk590/advisory-booking/88ef441cca36d7a28d5ce5db6d9959938e4c0f3f/booking.js";
  s.onload = function () {
    function bind() {
      var fn = window.downloadReceiptPdf || window.generateFilledReceiptPdf;
      if (!fn) return false;
      ["downloadReceipt", "btnDownloadReceipt"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.__rkkBound) {
          el.__rkkBound = true;
          el.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            fn(e);
          });
        }
      });
      return true;
    }
    if (!bind()) {
      var n = 0;
      var t = setInterval(function () {
        if (bind() || ++n > 50) clearInterval(t);
      }, 200);
    }
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest("#downloadReceipt, #btnDownloadReceipt, [data-action=download-receipt]");
      if (!t) return;
      e.preventDefault();
      var fn = window.downloadReceiptPdf || window.generateFilledReceiptPdf;
      if (typeof fn === "function") fn(e);
      else alert("PDF generator not ready. Wait a moment and try again.");
    });
  };
  s.onerror = function () {
    console.error("[booking] failed to load core booking.js");
    alert("Booking scripts failed to load. Please refresh.");
  };
  document.head.appendChild(s);
})();
