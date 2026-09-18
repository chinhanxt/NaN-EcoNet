if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  var meta1 = document.createElement('meta');
  meta1.name = "apple-mobile-web-app-capable";
  meta1.content = "yes";
  document.getElementsByTagName('head')[0].appendChild(meta1);

  var meta2 = document.createElement('meta');
  meta2.name = "apple-mobile-web-app-status-bar-style";
  meta2.content = "black-translucent";
  document.getElementsByTagName('head')[0].appendChild(meta2);
}