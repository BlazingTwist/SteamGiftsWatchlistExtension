const urlPatternAppIDKey = "${APPID}";
const steamImgUrlPattern = "https://steamcdn-a.akamaihd.net/steam/apps/" + urlPatternAppIDKey + "/header_292x136.jpg";
const steamStoreUrlPattern = "https://store.steampowered.com/app/" + urlPatternAppIDKey + "/";
const deleteButton_appIdAttribute = "appID";

let filterAppNameInput;
let sortDateAscending;
let sortDateDescending;

let storageTypes;

/**
 * @type {HTMLTableElement}
 */
let watchlistTableBody;

/**
 * @type {[{appID: string, appName: string, dateAdded: Date}]}
 */
let watchlist, watchlistActive;

/**
 * @readonly
 * @enum {number}
 */
const sortOrderEnum = {
    Ascending: 0,
    Descending: 1
}
/**
 * @type {sortOrderEnum|number}
 */
let sortOrder = sortOrderEnum.Ascending;

/**
 * @param {InputEvent} e
 */
const handleFilterAppName = function (e) {
    let filterText = e.target.value;
    let regex = new RegExp(filterText, "i");
    watchlistActive = watchlist
        .filter((elem) => regex.test(elem.appName));
    sortActiveWatchlist();
    renderActiveWatchlist();
}

const handleSortDateAscendingClicked = function () {
    sortDateAscending.classList.add("hidden");
    sortDateDescending.classList.remove("hidden");
    sortOrder = sortOrderEnum.Descending;
    sortActiveWatchlist();
    renderActiveWatchlist();
}

const handleSortDateDescendingClicked = function () {
    sortDateDescending.classList.add("hidden");
    sortDateAscending.classList.remove("hidden");
    sortOrder = sortOrderEnum.Ascending;
    sortActiveWatchlist();
    renderActiveWatchlist();
}

/**
 * @param {MouseEvent} e
 */
const handleAppDeleteButton = function (e) {
    /**
     * @type {HTMLElement}
     */
    let htmlElement = e.target;
    let appId = htmlElement.getAttribute(deleteButton_appIdAttribute);
    watchlist = watchlist.filter(app => app.appID !== appId);
    watchlistActive = watchlistActive.filter(app => app.appID !== appId);
    chrome.storage.sync.get(storageTypes.sg_watchlist.name, ({sg_watchlist}) => {
        sg_watchlist = sg_watchlist.filter(app => app.appID !== appId);
        // noinspection JSIgnoredPromiseFromCall
        chrome.storage.sync.set({[storageTypes.sg_watchlist.name]: sg_watchlist});
    })

    let tableRow = findParentElement(e.target, "tr");
    if(tableRow){
        tableRow.remove();
    }else{
        // tableRow not found (somehow ???), re-render page instead.
        renderActiveWatchlist();
    }
}

function getElements() {
    filterAppNameInput = document.getElementById("app_name_input");
    sortDateAscending = document.getElementById("sort_date_ascending_container");
    sortDateDescending = document.getElementById("sort_date_descending_container");
    watchlistTableBody = document.getElementById("watchlist_apps_table_body");
}

function localizePage() {
    // Localize by replacing __MSG_***__ meta tags
    let objects = document.getElementsByTagName('html');
    for (let object of objects) {
        let htmlString = object.innerHTML.toString();
        let newHtmlString = htmlString.replace(/__MSG_(\w+)__/g, function (match, msgKey) {
            return msgKey ? chrome.i18n.getMessage(msgKey) : "";
        });
        if (newHtmlString !== htmlString) {
            object.innerHTML = newHtmlString;
        }
    }
}

function registerEvents() {
    filterAppNameInput.addEventListener("input", handleFilterAppName);
    sortDateAscending.addEventListener("click", handleSortDateAscendingClicked);
    sortDateDescending.addEventListener("click", handleSortDateDescendingClicked);
}

/**
 * @param {[{appID: string, appName: string, dateAdded: string}]} jsonWatchlist
 * @returns {[{appID: string, appName: string, dateAdded: Date}]} dateWatchlist
 */
function watchlistJsonDatedToDateDated(jsonWatchlist){
    let dateWatchlist = [];
    jsonWatchlist.forEach(app => {
        dateWatchlist.push({appID: app.appID, appName: app.appName, dateAdded: new Date(app.dateAdded)});
    })
    return dateWatchlist;
}

/**
 * @param {[{appID: string, appName: string, dateAdded: Date}]} dateWatchlist
 * @returns {[{appID: string, appName: string, dateAdded: string}]} jsonWatchlist
 */
function watchlistDateDatedToJsonDated(dateWatchlist){
    let jsonWatchlist = [];
    dateWatchlist.forEach(app => {
        jsonWatchlist.push({appID: app.appID, appName: app.appName, dateAdded: app.dateAdded.toJSON()});
    })
    return jsonWatchlist;
}

/**
 * @param {string} unit_key
 * @param {number} numeric_value
 */
function getTimeUnitString(unit_key, numeric_value) {
    let fullKey = unit_key + (numeric_value === 1 ? "_one" : "_many");
    return chrome.i18n.getMessage(fullKey);
}

/**
 * converts the given milliseconds into a string, such as "5 seconds"
 * mapping:
 *  0-59_999 -> "0-59 second(s)"
 *  60_000-3_599_999 -> "1-59 minute(s)"
 *  3_600_000-86_399_999 -> "1-23 hour(s)"
 *  86_400_000-31_535_999_999 -> "1-364 day(s)"
 *  31_536_000_000-... -> "1-... year(s)"
 * @param {number} milliseconds
 * @return {string} formatted time
 */
function convertToTimeString(milliseconds) {
    let value;
    let unit_key;
    if (milliseconds < 60_000) {
        value = Math.floor(milliseconds / 1000);
        unit_key = "text_time_second"
    } else if (milliseconds < 3_600_000) {
        value = Math.floor(milliseconds / (1000 * 60));
        unit_key = "text_time_minute"
    } else if (milliseconds < 86_400_000) {
        value = Math.floor(milliseconds / (1000 * 60 * 60));
        unit_key = "text_time_hour"
    } else if (milliseconds < 31_536_000_000) {
        value = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
        unit_key = "text_time_day"
    } else {
        value = Math.floor(milliseconds / (1000 * 60 * 60 * 24 * 365));
        unit_key = "text_time_year"
    }
    return value + " " + getTimeUnitString(unit_key, value);
}

/**
 * @param {string} a
 * @param {string} b
 */
function caseInsensitiveEquals(a, b){
    return a.localeCompare(b, undefined, {sensitivity: "accent"}) === 0;
}

/**
 * @param {HTMLElement} element
 * @param {string} tagName tagName to look for
 * @returns {HTMLElement | null}
 */
function findParentElement(element, tagName){
    let parent = element.parentElement;
    while(parent){
        if(caseInsensitiveEquals(parent.tagName, tagName)){
            return parent;
        }
        parent = parent.parentElement;
    }
    return null;
}

/**
 * @param {HTMLElement} element
 * @param {string} toolTipText
 * @return {HTMLDivElement}
 */
function createTooltipForElement(element, toolTipText) {
    let tooltipContainer = document.createElement("div");
    tooltipContainer.classList.add("tooltip");

    let tooltipSpan = document.createElement("span");
    tooltipSpan.classList.add("tooltip-text");
    tooltipSpan.innerText = toolTipText;

    tooltipContainer.appendChild(tooltipSpan);
    tooltipContainer.appendChild(element);
    return tooltipContainer;
}

/**
 * @param {{appID: string, appName: string, dateAdded: Date}} appObject
 */
function addWatchlistEntry(appObject) {
    let newRow = watchlistTableBody.insertRow();

    let appNameCell = newRow.insertCell();
    let appRemoveButton = document.createElement("img");
    appRemoveButton.classList.add("inline-icon");
    appRemoveButton.src = "img/simpleDeleteRed.png";
    appRemoveButton.alt = "[X]";
    appRemoveButton.setAttribute(deleteButton_appIdAttribute, appObject.appID);
    appRemoveButton.addEventListener("click", handleAppDeleteButton);
    let appRemoveTooltip = createTooltipForElement(appRemoveButton, chrome.i18n.getMessage("html_app_remove_tooltip"))
    let appNameSpan = document.createElement("span");
    appNameSpan.innerText = appObject.appName;
    appNameCell.appendChild(appRemoveTooltip);
    appNameCell.appendChild(appNameSpan);

    let appIdCell = newRow.insertCell();
    appIdCell.innerText = appObject.appID;

    let dateAddedCell = newRow.insertCell();
    let timeDiff = new Date() - appObject.dateAdded;
    let dateAddedSpan = document.createElement("span");
    dateAddedSpan.innerText = convertToTimeString(timeDiff);
    let tooltipContainer = createTooltipForElement(dateAddedSpan, appObject.dateAdded.toLocaleString());
    dateAddedCell.appendChild(tooltipContainer);

    let appThumbnailCell = newRow.insertCell();
    let appThumbnailStoreHref = document.createElement("a");
    appThumbnailStoreHref.href = steamStoreUrlPattern.replace(urlPatternAppIDKey, appObject.appID)
    let appThumbnailImg = document.createElement("img");
    appThumbnailImg.src = steamImgUrlPattern.replace(urlPatternAppIDKey, appObject.appID);
    appThumbnailImg.alt = chrome.i18n.getMessage("text_image_load_failed");
    appThumbnailCell.appendChild(appThumbnailStoreHref);
    appThumbnailStoreHref.appendChild(appThumbnailImg);
}

function renderActiveWatchlist() {
    watchlistTableBody.innerHTML = "";
    for (let entry of watchlistActive) {
        addWatchlistEntry(entry);
    }
}

function sortActiveWatchlist() {
    const sortAsc = sortOrder === sortOrderEnum.Ascending;
    watchlistActive.sort((elemA, elemB) => sortAsc
        ? (elemB.dateAdded - elemA.dateAdded)
        : (elemA.dateAdded - elemB.dateAdded));
}

const main = function () {
    chrome.runtime.sendMessage({msg: "getStorageTypes"}, ({storage_types}) => {
        storageTypes = storage_types;
        chrome.storage.sync.get(storage_types.sg_watchlist.name,
            /**
             * @param {[{appID: string, appName: string, dateAdded: string}]} sg_watchlist
             */
            ({sg_watchlist}) => {
                sg_watchlist = sg_watchlist || [];

                // convert date json to Date object
                watchlist = watchlistJsonDatedToDateDated(sg_watchlist);
                watchlistActive = watchlist;

                localizePage();
                getElements();
                registerEvents();
                sortActiveWatchlist();
                renderActiveWatchlist();
            })
    });
}

window.addEventListener("load", main);