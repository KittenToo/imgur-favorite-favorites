Cookie = null;
IsChrome = true;

if (navigator.userAgent.indexOf("Chrome") < 0) {
    IsChrome = false;
}

function updateSID() {
    let sUsrAg = navigator.userAgent;
    if (IsChrome) {
        chrome.cookies.getAll({
            "domain": 'imgur.com'
        }, function (cookie) {
            _saveCookie(cookie)
        });
    } else {
        // fire fox needs this firstPartyDomain thing
        browser.cookies.getAll({
            "domain": 'imgur.com',
            "firstPartyDomain": "imgur.com"
        }).then(function (cookie) {
            _saveCookie(cookie)
        });
    }
}

function _saveCookie(cookie) {
    let o = {};
    for (let x in cookie) {
        o[cookie[x].name] = cookie[x];
    }
    Cookie = o;
}

updateSID();

// odd bug that using browser polyfill on chrome doesnt find sendresponse
b = browser;
if (IsChrome) {
    b = chrome;
}
b.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        console.log(sender.tab ?
            "from a content script:" + sender.tab.url :
            "from the extension: ", request);

        if (request.getSID == true) {
            updateSID(); // TODO async, next line wont have correct cookie 
            sendResponse(Cookie.IMGURUIDLOTAME.value);
        } else {
            sendResponse('command not found')
        }
    }
);


// intercept XHR metadata on favorites to mark already faved ones
// TODO implement the filter api for firefox instead of replaying the XHR
function chromeListener(details) {
    // if its the replayed XHR (marked by this &afh=1) we need to apply the cookies to make it work in firefox
    // chrome does apply cookies automatically but i guess we can just rewrite them
    if (details.url.indexOf('&afh=1') > -1) {
        let tmp = details.requestHeaders;
        let s = '';
        for (let i in Cookie) {
            s += i + '=' + Cookie[i].value + ';';
        }
        tmp.push({name: 'Cookie', value: s});
        return {requestHeaders: tmp}; // already a replayed request TODO maybe a better way than adding a parameter to URL?
    }
    let xhr = new XMLHttpRequest();
    xhr.open('GET', details.url + '&afh=1');
    xhr.responseType = "json";
    xhr.withCredentials = true;
    xhr.onload = function () {
        if (xhr.response.data.length > 0) {
            let x = [];
            for (let i of xhr.response.data) {
                if (i.favorite) {
                    x.push(i.id)
                }
            }
            console.log('sending message to', details)
            chrome.tabs.sendMessage(details.tabId, {favorites: x}, function(response) {});  
        }
    }
    xhr.send();
    return {};
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    chromeListener, {
        urls: ["*://api.imgur.com/3/account/*/gallery_favorites/*"],
        types: ["xmlhttprequest"]
    }, ["blocking", "requestHeaders"]
);