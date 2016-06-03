// ==UserScript==
// @name           Filmtipset Open Advanced Search Result In a New Window
// @namespace      https://github.com/Row/filmtipset-userscripts
// @description    As title
// @include        http://www.filmtipset.se/advsearch.cgi
// ==/UserScript==

document.forms[1].target = '_blank';