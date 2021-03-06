/**
 * Background script for ZeroNet
 * @author Karthikeyan VJ
 * @author Maciej Krüger
 */

var debug = { //Set what you want to debug
  "onProxy_Request": false,
  "onBeforeRequest": false,
  "onRequestUpdate": true //You may want to debug this if working with urls
}
var showDebug = true //Set to false on production


/**
 * Log Stuff
 */
function log() {
  if (!showDebug) return //Keep silent
  var args = Array.from(arguments)
  if (!args.length) return
  var title = args.shift()
  var res = []
  var str = logBuild(res, " " + title)
  var i = -1
  while (args.length) {
    var e = args.shift()
    str += " %c%s"
    if (i % 2) {
      while (e.length < 10) e += " "
      res.push("font-weight:bold;font-size:12px;", e)
    } else {
      res.push("font-weight:normal", e)
    }
    i++
  }
  logShow(str, res)
}

function logBuild(args, name) {
  args.push("color:white;background:#AD3AFD;font-weight:bold;font-size:14px", name, "background:transparent")
  return "%c[ZeroNet%s]%c "
}

function logShow(str, args) {
  args.unshift(str)
  console.log.apply(console, args)
}
const formats = {
  "onBeforeRequest": [{
      name: "hostname",
      space: 20,
      color: "green"
    },
    {
      name: "protocol",
      space: 8,
      color: "red"
    },
    {
      name: "url",
      space: 0,
      color: "blue",
      prop: "href"
    }
  ],
  "onRequestUpdate": [{
      name: "oldUrl",
      space: 25,
      color: "grey"
    },
    {
      name: "newUrl",
      space: 0,
      color: "blue"
    }
  ],
  "onProxy_Request": [{
      name: "proxy",
      space: 23,
      color: "green"
    },
    {
      name: "status",
      space: 10,
      color: "red"
    },
    {
      name: "url",
      space: 0,
      color: "blue"
    }
  ]
}

function showInfo(info, f) {
  if (!showDebug) return //Keep silent
  if (!debug[f]) return //Keep silent
  var args = [];
  var str = logBuild(args, " @ " + f);
  formats[f].map((r) => {
    var n = r.name
    var v = info[r.prop || n]
    var l = r.space
    while (v.length < l) v += " "
    str += "%c%s%c = %s"
    args.push(
      "color:" + r.color + ";background-color:light" + r.color + ";font-weight:bold",
      n,
      "color:" + r.color,
      v)
  })
  logShow(str, args)
}
log("started", "Now running")

function onBeforeRequest(details) {
  var currentURLRequest = document.createElement('a');
  currentURLRequest.href = details.url;

  function redirect(newUrl) {
    showInfo({
      oldUrl: currentURLRequest.href,
      newUrl
    }, "onRequestUpdate")
    if (newUrl !== undefined) return {
      redirectUrl: newUrl
    }
    /*chrome.tabs.update({
         url: newUrl
       });*/
  }

  showInfo(currentURLRequest, "onBeforeRequest")

  var isZeroTLD = false;
  var isZeroHost = false;

  // tld
  for (var i = 0; i < ZERO_ACCEPTED_TLDS.length; i++) {
    var currentTLD = currentURLRequest.hostname.slice(-ZERO_ACCEPTED_TLDS[i].length);
    if (currentTLD == ZERO_ACCEPTED_TLDS[i]) {
      isZeroTLD = true;
      break;
    }
  }

  // host
  var currentHost = currentURLRequest.host.toLowerCase();
  for (i = 0; i < ZERO_ACCEPTED_HOSTS.length; i++) {
    if (currentHost == ZERO_ACCEPTED_HOSTS[i]) {
      isZeroHost = true;
      if (!isZeroTLD) {
        var withoutHost = currentURLRequest.href.split(currentHost + "/")[1]
        var subFolder = withoutHost.split("/")[0] || withoutHost.split("/")[1] || "";
        var tld = ".bit" // TODO: for loop
        if (currentHost.indexOf(".") == -1 && subFolder.endsWith(tld)) {
          return redirect("http://" + subFolder + (withoutHost.split(tld)[1] || "/"))
        }
      }
      if (currentHost != "zero") {
        return redirect(currentURLRequest.href.replace(currentHost, "zero"))
      }
      break;
    }
  }

  if (isZeroTLD === false && isZeroHost === false) {
    // not a zeroNet TLD or Host, return immediately
    return;
  }


  /* TODO: fix this ____
  	var zite=currentURLRequest.href.split(".zite")
  	if (zite.length-1&&false) {
  		lock=true
  		zite=zite[0].replace("http://","");
  		if (zite.startsWith("1")&&zite.length==34&&!zite.match(/[^0-9a-zA-Z]/i)) {
  			newZite=currentURLRequest.href.replace(zite+".zite","zero/"+zite)
  			console.log("dot zite",newZite)
  			return {redirectUrl: newZite} // TODO: fix loop
  		}
  	}

  	ZERO_ACCEPTED_HOSTS.map((h) => {
  		if (currentHost==h&&currentHost!="zero"&&!lock) { //Redirect localhost to zero
  			var newUrl=currentURLRequest.href.replace(currentHost,"zero")
        console.log("REDD",newUrl)
  			if (newUrl !== undefined) chrome.tabs.update({
  				url: newUrl
  			});
  		}
  	})
  */

  // get data from local storage
  chrome.storage.local.get(function (item) {
    handleProxy(item.zeroHostData, currentURLRequest.href);
  });

}

function handleProxy(zeroHostData, url) {
  showInfo({
    proxy: zeroHostData,
    url,
    status: "handle"
  }, "onProxy_Request")
  zeroHostData = zeroHostData || DEFAULT__ZERO_HOST_DATA;

  var config = getPacConfig(zeroHostData);

  chrome.proxy.settings.set({
      value: config,
      scope: "regular"
    },
    function () {
      showInfo({
        proxy: zeroHostData,
        url,
        status: "done"
      }, "onProxy_Request")
    }
  );

}


function getPacConfig(zeroHostData) {
  //console.log("getPacConfig " + zeroHostData);
  function createMatches(ar) {
    var res = "function FindProxyForURL(url, host) {"
    res += "if ("
    ar.map((h) => {
      res += "shExpMatch(host, '" + h + "')||"
    })
    res += "false" //end the ||
    res += ") return 'PROXY " + zeroHostData + "'; else return 'DIRECT'"
    res += "}" //end the function
    //console.log("pac",ar,res)
    return res;
  }
  //console.log("pacmatch",ZERO_ACCEPTED_TLDS.map((h) => {return "*"+h}))
  var pacConfigWithLocalHost = {
    mode: "pac_script",
    pacScript: {
      data: createMatches(
        ZERO_ACCEPTED_TLDS.map((h) => {
          return "*" + h
        }).concat("zero") //Proxy "zero" too
      )
    }

  };

  var pacConfig = {
    mode: "pac_script",
    pacScript: {
      data: createMatches(
        ZERO_ACCEPTED_TLDS.map((h) => {
          return "*" + h
        })
        .concat(ZERO_ACCEPTED_HOSTS
          .map((h) => {
            return h
          })
        )
      )
    }

  };

  if (zeroHostData != DEFAULT__ZERO_HOST_DATA) {
    // user is running ZeroNet in remote machine
    // we can proxy 127.0.0.1:43110 and localhost:43110 to go through remote machine
    return pacConfig;
  }

  // user is ZeroNet running in his/her current machine, so we can't proxy 127.0.0.1:43110 connections
  // will end in infinite loop.
  return pacConfigWithLocalHost;
}

var ZERO_ACCEPTED_TLDS = [ /*".zero", */ ".bit", ".zite"]; // All tlds (beware .zero is now an offical tld - soon optional)
var ZERO_ACCEPTED_HOSTS = ["zero", "127.0.0.1:43110", "localhost:43110"]; // All hosts (zero must be included here)

// default settings data - location where your zeroNet is running
var DEFAULT__ZERO_HOST_DATA = "127.0.0.1:43110";

var filter = {
  urls: ["<all_urls>"]
};
var opt_extraInfoSpec = ["blocking" /*,"requestBody"*/ ];

chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, filter, opt_extraInfoSpec);

// to clear proxy
// remove and add the extension again

// proxy error listener
chrome.proxy.onProxyError.addListener(function (details) {
  console.log("%cAn error occured", "font-weight:bold;color:red;", details);
});

/**
 * Invoked when action button is clicked
 */
chrome.browserAction.onClicked.addListener(function () {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tabs) {
    //console.log(tabs);
    var activeTab = tabs[0];
    var inNewTab = (activeTab.url != "chrome://newtab/");
    openZeroHomePage(inNewTab);
  });
});

function openZeroHomePage(inNewTab) {
  if (inNewTab) {
    chrome.tabs.create({
      url: "http://zero/"
    });
  } else {
    chrome.tabs.update({
      url: 'http://zero'
    });
  }
}
