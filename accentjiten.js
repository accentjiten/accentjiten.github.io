/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024 accentjiten

*/

init().then(
	() => { },
	(error) => {
		console.error(error);
	}
);

async function init() {
	"use strict";
	
	const input = document.createElement("input");
	input.type = "text";
	input.style.fontSize = "20px";
	
	const loadingMsg = document.createElement("p");
	loadingMsg.innerHTML = "Loading...";
	document.body.appendChild(loadingMsg);
	
	let introDesc = document.createElement("p");
	introDesc.innerHTML = "日本語アクセント辞典<br>使い方：入力で単語を検索する<br><br>" +
		"Japanese pitch accent dictionary<br>(How to use: search a word<br>Try typing \"konnichiwa\")" +
		"<br><br>Coming soon: conjugations";
	
	const searchResults = document.createElement("p");
	let searchResultsChild;
	
	const worker = (() => {
		try {
			const ret = new Worker("accentjiten.worker.js");
			ret.addEventListener("message", (event) => handleWorkerResponse(event.data));
			ret.postMessage({name: "loadstart"});
			return ret;
		} catch (error) {
			console.error(error);
			handleWorkerResponse({name: "loaderror"});
		}
	})();
	
	let searchID = 0;
	let searchQuery;
	let nEntryElems = 0;
	const QUERY_MAX_LENGTH = 50;
	const MAX_ENTRY_ELEMS = 500;
	
	function handleWorkerResponse(data) {
		switch (data.name) {
			
			case "loadsuccess": {
				const title = document.createElement("p");
				title.innerHTML = "accentjiten [alpha]";
				document.body.removeChild(loadingMsg);
				document.body.appendChild(title);
				document.body.appendChild(input);
				document.body.appendChild(introDesc);
				document.body.appendChild(searchResults);
				input.addEventListener("input", (event) => {
					const query = input.value;
					searchID += 1;
					nEntryElems = 0;
					if (query.length === 0) {
						searchQuery = null;
						handleWorkerResponse(
							{name: "searchresults", results: {searchID: searchID, end: true, nResults: 0}});
					} else if (query.length > QUERY_MAX_LENGTH) {
						searchQuery = query.substring(0, QUERY_MAX_LENGTH) + "...";
						handleWorkerResponse(
							{name: "searchresults", results: {searchID: searchID, end: true, nResults: 0}});
					} else {
						searchQuery = query;
						worker.postMessage({name: "searchstart", query: query, searchID: searchID});
					}
				});
				input.focus();
				break;
			}
			
			case "loaderror": {
				loadingMsg.innerHTML = "Error";
				break;
			}
			
			case "searchresults": {
				const results = data.results;
				const end = results.end;
				const entries = results.entries;
				const nResults = results.nResults;
				if (results.searchID === searchID) {
					if (end || (entries && entries.length > 0)) {
						
						if (nEntryElems === 0) {
							if (introDesc) {
								document.body.removeChild(introDesc);
								introDesc = null;
							}
							if (searchResultsChild) {
								searchResults.removeChild(searchResultsChild);
							}
							searchResultsChild = document.createElement("span");
							searchResultsChild.setAttribute("style", "white-space:nowrap;");
							
							if (searchQuery) {
								const descElem = document.createElement("p");
								const descElemChild1 = document.createElement("span");
								if (nResults === 0) {
									descElemChild1.textContent = "何も見つかりませんでした - \"";
								} else if (nResults > MAX_ENTRY_ELEMS) {
									descElemChild1.textContent = MAX_ENTRY_ELEMS + "件を表示中 - \"";
								} else {
									descElemChild1.textContent = nResults + "件 - \"";
								}
								const descElemChild2 = document.createElement("b");
								descElemChild2.textContent = searchQuery;
								const descElemChild3 = document.createElement("span");
								descElemChild3.textContent = "\"";
								descElem.appendChild(descElemChild1);
								descElem.appendChild(descElemChild2);
								descElem.appendChild(descElemChild3);
								searchResultsChild.appendChild(descElem);
							}
							
							searchResults.appendChild(searchResultsChild);
						}
						
						if (entries) {
							for (const entry of entries) {
								const entryElem = createEntryElem(entry);
								
								searchResultsChild.appendChild(entryElem);
								searchResultsChild.appendChild(document.createElement("hr"));
								
								nEntryElems += 1;
								if (nEntryElems === MAX_ENTRY_ELEMS) {
									break;
								}
							}
						}
					}
					
					if (!end && nEntryElems !== MAX_ENTRY_ELEMS) {
						worker.postMessage({name: "searchcontinue"});
					}
				}
				break;
			}
			
		}
	}
	
	function createEntryElem(entry) {
		const midashigo = entry.word;
		const pronunciations = entry.pronunciations;
		
		const mainTable = document.createElement("table");
		const mainTableTr = document.createElement("tr");
		
		const leftBraceSpan = document.createElement("span");
		const rightBraceSpan = document.createElement("span");
		leftBraceSpan.textContent = "「";
		rightBraceSpan.textContent = "」";
		const midashigoSpan = document.createElement("span");
		midashigoSpan.textContent = midashigo;
		const midashigoElem = document.createElement("span");
		midashigoElem.appendChild(leftBraceSpan);
		midashigoElem.appendChild(midashigoSpan);
		midashigoElem.appendChild(rightBraceSpan);
		const midashigoTd = document.createElement("td");
		midashigoTd.appendChild(midashigoElem);
		mainTableTr.appendChild(midashigoTd);
		
		const pronunciationTable = document.createElement("table");
		
		for (let i = 0; i < pronunciations.length; i++) {
			const pronunciation = pronunciations[i];
			const sources = pronunciation.sources;
			
			const tableTr = document.createElement("tr");
			
			const pronunciationElem = createAccentElem(pronunciation.accent, pronunciation.tokenizedKana);
			const pronunciationTd = document.createElement("td");
			pronunciationTd.setAttribute("style", "padding-top:5px;padding-bottom:5px;");
			pronunciationTd.appendChild(pronunciationElem);
			
			const sourcesElem = document.createElement("small");
			sourcesElem.textContent = " ×" + sources.length;
			sourcesElem.setAttribute("style", "text-align:center;");
			sourcesElem.setAttribute("style", "color:#999999;");
			const sourceCountElem = document.createElement("small");
			const sourceCountElem2 = document.createElement("small");
			sourceCountElem.appendChild(sourceCountElem2);
			sourceCountElem2.textContent = " " + sources.join(", ");
			sourceCountElem2.setAttribute("style", "text-align:center;");
			sourcesElem.appendChild(sourceCountElem);
			pronunciationTd.appendChild(sourcesElem);
			
			tableTr.appendChild(pronunciationTd);
			
			pronunciationTable.appendChild(tableTr);
		}
		mainTableTr.appendChild(pronunciationTable);
		
		mainTable.appendChild(mainTableTr);
		
		return mainTable;
	}
	
	function createAccentElem(accent, tokenizedKana) {
		const elem = document.createElement("span");
		
		const div = document.createElement("div");
		div.className = "tonetext";
		
		const H_CHARCODE = "H".charCodeAt(0);
		let accentI = 0;
		for (let i = 0; i < tokenizedKana.length; i++) {
			const token = tokenizedKana[i];
			const nextToken = tokenizedKana[i + 1];
			const tokenIsHigh = accent.charCodeAt(
				accentI === accent.length - 2 ? accent.length - 1 : accentI)
					=== H_CHARCODE;
			const nextTokenIsHigh =
				token.type !== "mora" ? tokenIsHigh :
					!nextToken ? accent.charCodeAt(accent.length - 1) === H_CHARCODE :
						accent.charCodeAt(accentI === accent.length - 3
							? accent.length - 1 : accentI + 1) === H_CHARCODE;
			
			const tokenElem = document.createElement("span");
			tokenElem.textContent = token.value;
			tokenElem.className = tokenIsHigh
				? nextTokenIsHigh ? "hightone" : "hightonenextlow"
				: nextTokenIsHigh ? "lowtonenexthigh" : "lowtone";
			div.appendChild(tokenElem);
			
			if (token.type === "mora") {
				accentI += 1;
			}
		}
		
		elem.appendChild(div);
		
		return elem;
	}
	
}
