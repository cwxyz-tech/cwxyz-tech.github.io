(function () {
  "use strict";

  // Use Google's site-restricted search so visitors can search indexed pages
  // without requiring a server-side search service.
  window.siteSearch = function (form) {
    var field = form && form.querySelector('input[name="q"]');
    var query = field ? field.value.trim() : "";
    if (!query) {
      if (field) field.focus();
      return false;
    }
    var searchUrl = "https://www.google.com/search?q=" +
      encodeURIComponent("site:coleswebsite.xyz " + query);
    window.location.href = searchUrl;
    return false;
  };
})();