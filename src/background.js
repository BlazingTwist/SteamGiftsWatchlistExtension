// TODO export/import watchlist / clear storage button
// TODO counter for games on watchlist? counter for results in filtered watchlist?
const storage_types = {
    /**
     * Stores a list of steam games
     */
    sg_watchlist: {
        name: "sg_watchlist",
        /**
         * @type {[{appID: string, appName: string, dateAdded: string}]}
         */
        type: []
    }
}

let appList;

const getAppNameFromAppList = function (appId) {
    let appIdNumber = Number.parseInt(appId);
    let app = appList.find(app => app["appid"] === appIdNumber);
    return app ? app.name : null;
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    const {msg, arg0} = request;
    if (msg === "getStorageTypes") {
        sendResponse({storage_types});
        return true;
    } else if (msg === "getAppName") {
        // arg0 - appID
        if (appList) {
            sendResponse({"appName": getAppNameFromAppList(arg0)});
        } else {
            fetch("https://api.steampowered.com/ISteamApps/GetAppList/v2/")
                .then(response => response.text())
                .then(result => {
                    // magic faith in the steam api
                    appList = JSON.parse(result).applist.apps;
                    sendResponse({"appName": getAppNameFromAppList(arg0)});
                })
        }
        return true;
    }
})

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (!tab.url) {
        return;
    }
    if (changeInfo.status !== "complete") {
        return;
    }
    if (tab.url.includes("steamgifts.com/giveaways/entered")) {
        // noinspection JSIgnoredPromiseFromCall
        chrome.scripting.executeScript({target: {tabId: tabId}, func: onPageLoad_enteredGiveaways})
    } else if (tab.url.includes("steamgifts.com/giveaways/search") || tab.url.endsWith("steamgifts.com/")) {
        // noinspection JSIgnoredPromiseFromCall
        chrome.scripting.executeScript({target: {tabId: tabId}, func: onPageLoad_browseGiveaways})
    } else if (tab.url.includes("steamgifts.com/giveaway/")) {
        // noinspection JSIgnoredPromiseFromCall
        chrome.scripting.executeScript({target: {tabId: tabId}, func: onPageLoad_giveawayDetails})
    }
})

function onPageLoad_enteredGiveaways() {
    // entered GA page does not provide appID -> cannot add to watchlist from here.
    // instead, check appName and apply highlighting
    chrome.runtime.sendMessage({msg: "getStorageTypes"}, ({storage_types}) => {
        chrome.storage.local.get(storage_types.sg_watchlist.name,
            /**
             * @param {[{appID: string, appName: string, dateAdded: string}]} sg_watchlist
             */
            ({sg_watchlist}) => {
                sg_watchlist = sg_watchlist || [];

                /**
                 * @param {HTMLElement} headerElement
                 * @param {boolean} highlight
                 */
                const applyHighlight = function (headerElement, highlight) {
                    if (highlight) {
                        // TODO configurable highlighting
                        headerElement.style.backgroundColor = "#a5ffc0";
                    } else {
                        headerElement.style.backgroundColor = null;
                    }
                }

                let giveawayHeaderXpath = "//*[@class='table__row-inner-wrap']";
                let appNameHeaderXpath = ".//*[@class='table__column__heading']";
                let appNameRegex = /^(.+?)(?: \([0-9]+ Copies\))?$/i;
                let giveawayHeaders = document.evaluate(giveawayHeaderXpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < giveawayHeaders.snapshotLength; i++) {
                    let giveawayHeader = giveawayHeaders.snapshotItem(i);
                    let appNameElement = document.evaluate(appNameHeaderXpath, giveawayHeader, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    let fullAppName = appNameElement.singleNodeValue.innerHTML;
                    let appName = appNameRegex.exec(fullAppName)[1].trim();

                    // if appID is on watchlist -> highlight
                    if (sg_watchlist.some(entry => entry.appName.trim() === appName)) {
                        applyHighlight(giveawayHeader, true);
                    }
                }
            })
    })
}

function onPageLoad_browseGiveaways() {
    chrome.runtime.sendMessage({msg: "getStorageTypes"}, ({storage_types}) => {
        const watchlistButton_appIdAttribute = "appID";
        let addWatchlistButtons = [];
        let deleteWatchlistButtons = [];
        chrome.storage.local.get(storage_types.sg_watchlist.name,
            /**
             * @param {[{appID: string, appName: string, dateAdded: string}]} sg_watchlist
             */
            ({sg_watchlist}) => {
                sg_watchlist = sg_watchlist || [];

                /**
                 * @param {HTMLElement} headerElement
                 * @param {boolean} highlight
                 */
                const applyHighlight = function (headerElement, highlight) {
                    if (highlight) {
                        // TODO configurable highlighting
                        headerElement.style.backgroundColor = "#a5ffc0";
                    } else {
                        headerElement.style.backgroundColor = null;
                    }
                }

                /**
                 * @param {MouseEvent} e
                 */
                const onWatchlistAddClick = function (e) {
                    /**
                     * @type {HTMLElement}
                     */
                    let htmlElement = e.target;
                    let appId = htmlElement.getAttribute(watchlistButton_appIdAttribute);
                    chrome.runtime.sendMessage({msg: "getAppName", arg0: appId}, ({appName}) => {
                        if (!appName) {
                            alert(chrome.i18n.getMessage("alert_steam_api_failed"));
                            return;
                        }

                        addWatchlistButtons
                            .filter(button => button.getAttribute(watchlistButton_appIdAttribute) === appId)
                            .forEach(button => {
                                button.style.display = "none";
                                applyHighlight(button.parentElement, true);
                            });
                        deleteWatchlistButtons
                            .filter(button => button.getAttribute(watchlistButton_appIdAttribute) === appId)
                            .forEach(button => button.style.display = "block");

                        chrome.storage.local.get(storage_types.sg_watchlist.name, ({sg_watchlist}) => {
                            sg_watchlist = sg_watchlist || [];
                            if (!sg_watchlist.some(entry => entry.appID === appId)) {
                                sg_watchlist.push({
                                    "appID": appId,
                                    "appName": appName,
                                    "dateAdded": (new Date()).toJSON()
                                });
                                // noinspection JSIgnoredPromiseFromCall
                                chrome.storage.local.set({[storage_types.sg_watchlist.name]: sg_watchlist})
                            }
                        })
                    })
                };

                /**
                 * @param {MouseEvent} e
                 */
                const onWatchlistRemoveClick = function (e) {
                    /**
                     * @type {HTMLElement}
                     */
                    let htmlElement = e.target;
                    let appId = htmlElement.getAttribute(watchlistButton_appIdAttribute);
                    addWatchlistButtons
                        .filter(button => button.getAttribute(watchlistButton_appIdAttribute) === appId)
                        .forEach(button => {
                            button.style.display = "block";
                            applyHighlight(button.parentElement, false);
                        });
                    deleteWatchlistButtons
                        .filter(button => button.getAttribute(watchlistButton_appIdAttribute) === appId)
                        .forEach(button => button.style.display = "none");
                    chrome.storage.local.get(storage_types.sg_watchlist.name, ({sg_watchlist}) => {
                        sg_watchlist = sg_watchlist || [];
                        if (sg_watchlist.some(entry => entry.appID === appId)) {
                            sg_watchlist = sg_watchlist.filter(entry => entry.appID !== appId);
                            // noinspection JSIgnoredPromiseFromCall
                            chrome.storage.local.set({[storage_types.sg_watchlist.name]: sg_watchlist})
                        }
                    })
                }

                const createWatchlistButton = function (isDelete, appID) {
                    let watchlistButton = document.createElement("img");
                    watchlistButton.style.height = "1.5em";
                    watchlistButton.style.paddingLeft = "5px";
                    if (isDelete) {
                        watchlistButton.src = chrome.runtime.getURL("img/detailDeleteBlack2.png");
                        watchlistButton.alt = "[X]";
                        watchlistButton.addEventListener("click", onWatchlistRemoveClick);
                    } else {
                        watchlistButton.src = chrome.runtime.getURL("img/detailSaveBlack.png");
                        watchlistButton.alt = "[+]";
                        watchlistButton.addEventListener("click", onWatchlistAddClick);
                    }
                    watchlistButton.style.opacity = "0.6";
                    watchlistButton.setAttribute(watchlistButton_appIdAttribute, appID);
                    return watchlistButton;
                }

                let giveawayHeaderXpath = "//*[@class='giveaway__heading']"
                let searchUrlXpath = "string(./a/i[@class='fa fa-fw fa-search']/../@href)"
                let appIDRegex = /.*?=([0-9]+)/;
                let giveawayHeaders = document.evaluate(giveawayHeaderXpath, document, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
                for (let i = 0; i < giveawayHeaders.snapshotLength; i++) {
                    let giveawayHeader = giveawayHeaders.snapshotItem(i);
                    let searchUrl = document.evaluate(searchUrlXpath, giveawayHeader, null, XPathResult.STRING_TYPE, null);
                    let appID = appIDRegex.exec(searchUrl.stringValue)[1];

                    // if appID is on watchlist -> highlight, show 'remove from watchlist' button
                    // otherwise -> show 'add to watchlist' button
                    let addToWatchlistButton = createWatchlistButton(false, appID);
                    addWatchlistButtons.push(addToWatchlistButton);
                    let removeFromWatchlistButton = createWatchlistButton(true, appID);
                    deleteWatchlistButtons.push(removeFromWatchlistButton);

                    if (sg_watchlist.some(entry => entry.appID === appID)) {
                        addToWatchlistButton.style.display = "none";
                        removeFromWatchlistButton.style.display = "block";
                        applyHighlight(giveawayHeader, true);
                    } else {
                        addToWatchlistButton.style.display = "block";
                        removeFromWatchlistButton.style.display = "none";
                    }

                    giveawayHeader.appendChild(addToWatchlistButton);
                    giveawayHeader.appendChild(removeFromWatchlistButton);
                }
            })
    })
}

function onPageLoad_giveawayDetails() {
    /* TODO holy duplication!
     *   figure out how to extract methods for re-use
     *    (maybe two content-scripts? one for loading functions and another that actually uses them?)
     */
    // adds button: add/remove to/from watchlist
    chrome.runtime.sendMessage({msg: "getStorageTypes"}, ({storage_types}) => {
        let appId;
        let addWatchlistButton;
        let deleteWatchlistButton;
        chrome.storage.local.get(storage_types.sg_watchlist.name,
            /**
             * @param {[{appID: string, appName: string, dateAdded: string}]} sg_watchlist
             */
            ({sg_watchlist}) => {
                sg_watchlist = sg_watchlist || [];

                const onWatchlistAddClick = function () {
                    chrome.runtime.sendMessage({msg: "getAppName", arg0: appId}, ({appName}) => {
                        if (!appName) {
                            alert(chrome.i18n.getMessage("alert_steam_api_failed"));
                            return;
                        }

                        addWatchlistButton.style.display = "none";
                        deleteWatchlistButton.style.display = "block";

                        chrome.storage.local.get(storage_types.sg_watchlist.name, ({sg_watchlist}) => {
                            sg_watchlist = sg_watchlist || [];
                            if (!sg_watchlist.some(entry => entry.appID === appId)) {
                                sg_watchlist.push({
                                    "appID": appId,
                                    "appName": appName,
                                    "dateAdded": (new Date()).toJSON()
                                });
                                // noinspection JSIgnoredPromiseFromCall
                                chrome.storage.local.set({[storage_types.sg_watchlist.name]: sg_watchlist})
                            }
                        })
                    })
                };

                const onWatchlistRemoveClick = function () {
                    addWatchlistButton.style.display = "block";
                    deleteWatchlistButton.style.display = "none";
                    chrome.storage.local.get(storage_types.sg_watchlist.name, ({sg_watchlist}) => {
                        sg_watchlist = sg_watchlist || [];
                        if (sg_watchlist.some(entry => entry.appID === appId)) {
                            sg_watchlist = sg_watchlist.filter(entry => entry.appID !== appId);
                            // noinspection JSIgnoredPromiseFromCall
                            chrome.storage.local.set({[storage_types.sg_watchlist.name]: sg_watchlist})
                        }
                    })
                }

                const createWatchlistButton = function (isDelete) {
                    let watchlistButton = document.createElement("img");
                    watchlistButton.style.height = "2em";
                    if (isDelete) {
                        watchlistButton.src = chrome.runtime.getURL("img/simpleDeleteRed.png");
                        watchlistButton.alt = "[X]";
                        watchlistButton.addEventListener("click", onWatchlistRemoveClick);
                    } else {
                        watchlistButton.src = chrome.runtime.getURL("img/simpleSaveGreen.png");
                        watchlistButton.alt = "[+]";
                        watchlistButton.addEventListener("click", onWatchlistAddClick);
                    }
                    watchlistButton.style.opacity = "0.6";
                    return watchlistButton;
                }

                let giveawayHeaderXpath = "//*[@class='featured__heading']"
                let searchUrlXpath = "string(./a/i[@class='fa fa-fw fa-search']/../@href)"
                let appIDRegex = /.*?=([0-9]+)/;
                let giveawayHeaderXpathResult =
                    document.evaluate(giveawayHeaderXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                let giveawayHeader = giveawayHeaderXpathResult.singleNodeValue;
                let searchUrl = document.evaluate(searchUrlXpath, giveawayHeader, null, XPathResult.STRING_TYPE, null);
                appId = appIDRegex.exec(searchUrl.stringValue)[1];

                // if appID is on watchlist -> show 'remove from watchlist' button
                // otherwise -> show 'add to watchlist' button
                addWatchlistButton = createWatchlistButton(false);
                deleteWatchlistButton = createWatchlistButton(true);

                if (sg_watchlist.some(entry => entry.appID === appId)) {
                    addWatchlistButton.style.display = "none";
                    deleteWatchlistButton.style.display = "block";
                } else {
                    addWatchlistButton.style.display = "block";
                    deleteWatchlistButton.style.display = "none";
                }

                giveawayHeader.appendChild(addWatchlistButton);
                giveawayHeader.appendChild(deleteWatchlistButton);
            })
    })
}