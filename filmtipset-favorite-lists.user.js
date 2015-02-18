// ==UserScript==
// @name       Filmtipset favorite lists
// @namespace  https://github.com/Row/filmtipset-userscripts
// @version    0.7
// @description Makes it possible to highligt movies that are present in pre-selected lists.
// @match      http://nyheter24.se/filmtipset/*
// @copyright  2014+, Row
// ==/UserScript==

/* jQuery from site */
var $ = unsafeWindow.jQuery,
  jQuery = unsafeWindow.jQuery;

/**
 * Unique for array
 */
Array.prototype.unique = function() {
  var u = {},
    a = [];
  for (var i = 0, l = this.length; i < l; ++i) {
    if (u.hasOwnProperty(this[i])) {
      continue;
    }
    a.push(this[i]);
    u[this[i]] = 1;
  }
  return a;
};

function ListHandler()
{
  var STORAGE_KEY = "filmtipsetLists",
    lists,
    dfds = [],
    /**
     * Private
     */
    generateListUrl = function(listId, memberId, pageOffset)
    {
      return "http://nyheter24.se/filmtipset/yourpage.cgi?member=" + memberId
             + "&page=package_view&package=" + listId
             + "&page_nr=" + pageOffset;
    },
    persist = function()
    {
      GM_setValue(STORAGE_KEY, JSON.stringify(lists)); /* Prototype breaks stringify, this is handled on parse */
    },
    collectObjects = function(htmlData, listId)
    {
      lists[listId].objects = lists[listId].objects.concat(parseObjects(htmlData, listId));
    },
    collectListInfo = function(htmlData, listId)
    {
      var pageOffsetsCount = [],
        url, i;
      htmlData.replace(
        /page_nr=(\d+)/gm,
        function(m, n) {
          if (n != 1)
            pageOffsetsCount.push(n);
        }
      );
      pageOffsetsCount = pageOffsetsCount.unique();
      for (i = 0; i < pageOffsetsCount.length; i++) {
        var list = lists[listId];
        url = generateListUrl(listId, list.memberId, pageOffsetsCount[i]);
        dfds.push($.get(url, function(data) {
          collectObjects(data, listId);
        }));
      }
      collectObjects(htmlData, listId, dfds);
      $.when.apply(window, dfds).done(function() {
        window.setTimeout(persist, 100);
        dfds = [];
      });
    },
    parseObjects = function(htmlData, listId)
    {
      var list = [];

      htmlData.replace(
        /'info_(\d+)'/gm,
        function(m, n) {
          list.push(n);
        }
      );
      return list.unique();
    },
    updateLists = function()
    {
      var listId,
          offset = 60 * 60 * 24 * 1000, // Milliseconds
          nextUpdate = new Date().getTime() - offset;
      for (listId in lists) {
        if (!lists.hasOwnProperty(listId))
          continue;

        var list = lists[listId];
        if (nextUpdate > list.lastUpdate) {
          list.objects = [];
          list.lastUpdate = new Date().getTime();
          var url = generateListUrl(listId, list.memberId, 1);
          $.get(url, function(data) {
            collectListInfo(data, listId)
          });
          break; /* update max one list per page load */
        }
      }
    },
    loadLists = function()
    {
      try {
        lists = JSON.parse(GM_getValue(STORAGE_KEY));

        /* Helvetes, Prototype breaks the native stringify, remove this in the future */
        for (var listId in lists) {
          if (!lists.hasOwnProperty(listId))
            continue;

          var list = lists[listId];
          if (typeof list.objects == "string")
            list.objects = JSON.parse(list.objects);

        }
      } catch (err) {
        console.error("Limited support? Malformed JSON? First run?");
        lists = {};
      }
    };

  /**
   * Public
   */
  this.getLists = function()
  {
    for (listId in lists) {
      if (!lists.hasOwnProperty(listId))
        continue;

      lists[listId].url = generateListUrl(listId, lists[listId].memberId, 1);
    }
    return lists;
  };

  this.addList = function(listId, memberId, title, color)
  {
    loadLists();
    lists[listId] = {
      "title": title,
      "lastUpdate": 0,
      "listId": listId,
      "memberId": memberId,
      "color": color,
      "objects": []
    };
    updateLists();
  };

  this.hardRefresh = function(listId)
  {
    lists[listId].lastUpdate = 0;
    updateLists();
  };

  this.removeList = function(listId)
  {
    console.log("del", listId);
    delete lists[listId];
    persist();
  };

  /**
   * Init
   */
  loadLists();
  updateLists();
}

function renderAdmin(list)
{
  var elBtn, elHld, elCol;
  if (!/package_view/.test(document.location.href))
    return;
  elHld = $('<li class="add-new rightlink" />');
  $("#favoriteLists").append(elHld);
  $('<div class="in-list-admin"></div>').prependTo(elHld);
  elCol = $('<input type="text" value="#FF0000" title="Färgkod på listan t.ex: #FF0000, yellow eller blue" />')
    .on("keyup change", function() {
      $(this).siblings('.in-list-admin').css('background', $(this).val());
    })
  elBtn = $("<button>Spara listan till favoriter</button>")
    .on("click", function() {
      var title, memberId, listId, url, matches;
      url = document.location.href;
      title = $('h1').text();
      matches = /\bmember=(\d+).*?\bpackage=(\d+)/.exec(url);
      memberId = matches[1];
      listId = matches[2];
      list.addList(listId, memberId, title, elCol.val());
      $('<span style="color: green; font-weight:bold">Sparad</span>').insertAfter(elBtn).fadeOut(3000);
    });

  elCol.change().appendTo(elHld);
  elBtn.appendTo(elHld);
}

function renderList(list)
{
  var elDestination = $("td > div.rightlink").last(),
    ul = $('<ul id="favoriteLists" />')
    .insertAfter(elDestination)
    .on("click", ".delete", function() {
      list.removeList($(this).data('listId'));
      $(this).parent().hide();
    })
    .on('click', '.refresh', function() {
      list.hardRefresh($(this).data('listId'));
    });
  lists = list.getLists();
  $('<div class="rightlinkheader">Favoritlistor</div>').insertAfter(elDestination);

  for (var listId in lists) {
    if (!lists.hasOwnProperty(listId))
      continue;
    var l = lists[listId];
    var li = $('<li class="rightlink">').appendTo(ul);
    $('<a>').text(l.title).attr('href', l.url).appendTo(li);
    $('<div class="in-list-admin"></div>').css('background', l.color).prependTo(li);
    $('<button class="refresh">↻</button>').data("listId", listId).appendTo(li);
    $('<button class="delete">X</button>').data("listId", listId).appendTo(li);
  }

}

function isMoviePage()
{
  return /filmtipset\/film\//.test(document.location.href);
}

function renderMarkers(lists)
{
  var lists = lists.getLists();
  var offset = 0;
  var renderer = isMoviePage() ? new RenderSinglePage() : new RenderListPage();
  for (listId in lists) {
    if (!lists.hasOwnProperty(listId))
      continue;
    var list = lists[listId]
    renderer.color = list.color;
    for (var i = 0; i < list.objects.length; i++) {
      renderer.render(list.objects[i]);
    }
    renderer.increaseOffset();
  }
}

/* Render markers */
var Renderer = {
  color: 'green',
  offset: 0,
  increaseOffset: function()
  {
    this.offset++;
  }
}

function RenderSinglePage()
{
  var currentId = $('input[type=hidden][name=object]').val();
  this.render = function(movieId)
  {
    if(currentId == movieId) {
      $('.movie_header').append(
        $('<div class="in-list"></div>')
          .css('background', this.color)
          .css('left', (this.offset * 10) + 'px'));
    }
  }
}
RenderSinglePage.prototype = Renderer;

function RenderListPage()
{
  this.render = function(movieId)
  {
    var elTarget = $("#info_" + movieId);
    if (elTarget.length) {
      $('<div class="in-list"></div>')
        .css('background', this.color)
        .css('left', (this.offset * 7) + 'px')
        .appendTo(elTarget.siblings('.row').first());
    }
  }
}
RenderListPage.prototype = Renderer;

/* Init and render */
GM_addStyle(
  '#favoriteLists {padding: 0 0 0 10px}'
  + '#favoriteLists>li {display: block;position:relative;}'
  + '#favoriteLists .delete {position:absolute;right:0;top:0;}'
  + '#favoriteLists .refresh {position:absolute;right: 24px;top: -1px;}'
  + '#favoriteLists>li button {display: none;}'
  + '#favoriteLists>li:hover button, #favoriteLists>li.add-new button {display: block;margin-top: 2px}'
  + '.in-list, .in-list-admin {z-index: 6;border: 1px solid #000000; border-radius: 4px;width: 8px; height: 8px;position: absolute}'
  + '.in-list {margin-left: 300px;top: 3px;}'
  + '.in-list-admin {margin-left: -12px; top:6px;}'
  + '.movie_header {position:relative;}'
  + '.movie_header .in-list {transform:scale(2);}'
);

var list = new ListHandler();
renderList(list);
renderMarkers(list);
renderAdmin(list);
