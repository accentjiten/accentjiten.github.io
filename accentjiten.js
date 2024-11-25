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
	
	const titleElem = document.getElementsByTagName("h1")[0];
	titleElem.innerHTML = "accentjiten [alpha]<br><br>読み込み中...<br>Loading...";
	
	const worker = (() => {
		let error = null;
		try {
			const ret = new Worker("accentjiten.worker.js");
			ret.addEventListener("message", (event) => handleWorkerResponse(event.data));
			ret.postMessage({name: "loadstart"});
			return ret;
		} catch (e) {
			error = e;
		} finally {
			if (error) {
				handleWorkerResponse({name: "loaderror"});
			}
		}
	})();
	
	let searchResults;
	let searchResultsChild;
	
	let searchID = 0;
	let searchQuery;
	let nEntryElems = 0;
	const QUERY_MAX_LENGTH = 50;
	const MAX_ENTRY_ELEMS = 500;
	
	function handleWorkerResponse(data) {
		switch (data.name) {
			
			case "loadsuccess": {
				titleElem.innerHTML = "accentjiten [alpha]";
				const inputDiv = document.createElement("div");
				inputDiv.setAttribute("class", "search-bar");
				const input = document.createElement("input");
				input.setAttribute("type", "text");
				input.setAttribute("placeholder", "単語を検索 - Search...");
				inputDiv.appendChild(input);
				document.body.appendChild(inputDiv);
				searchResults = document.createElement("main");
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
							if (searchResultsChild) {
								searchResults.removeChild(searchResultsChild);
							}
							searchResultsChild = document.createElement("span");
							
							if (searchQuery) {
								const descElem = document.createElement("div");
								descElem.setAttribute("class", "results-counter");
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
		const entryElem = document.createElement("div");
		entryElem.setAttribute("class", "entry");
		
		const midashigo = entry.word;
		const pronunciations = entry.pronunciations;
		
		const mainTable = document.createElement("table");
		const mainTableTr = document.createElement("tr");
		
		const leftBraceSpan = document.createElement("span");
		const rightBraceSpan = document.createElement("span");
		leftBraceSpan.setAttribute("class", "entry-title-bracket");
		rightBraceSpan.setAttribute("class", "entry-title-bracket");
		leftBraceSpan.textContent = "「";
		rightBraceSpan.textContent = "」";
		const midashigoSpan = document.createElement("span");
		midashigoSpan.textContent = midashigo;
		const midashigoElem = document.createElement("span");
		midashigoElem.setAttribute("class", "entry-title");
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
			pronunciationTd.setAttribute("class", "data-content");
			pronunciationTd.appendChild(pronunciationElem);
			
			const sourcesElem = document.createElement("small");
			sourcesElem.textContent = " ×" + sources.length;
			sourcesElem.setAttribute("class", "source-counter");
			const sourceCountElem = document.createElement("small");
			sourceCountElem.setAttribute("class", "sources");
			const sourceCountElem2 = document.createElement("small");
			sourceCountElem.appendChild(sourceCountElem2);
			sourceCountElem2.textContent = " " + sources.join(", ");
			sourcesElem.appendChild(sourceCountElem);
			pronunciationTd.appendChild(sourcesElem);
			
			tableTr.appendChild(pronunciationTd);
			
			pronunciationTable.appendChild(tableTr);
		}
		mainTableTr.appendChild(pronunciationTable);
		
		mainTable.appendChild(mainTableTr);
		entryElem.appendChild(mainTable);
		
		return entryElem;
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
