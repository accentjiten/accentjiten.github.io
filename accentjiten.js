/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024-2025 accentjiten

*/



init(this).then(
	() => { },
	(error) => {
		console.error(error);
	}
);

async function init(mainScope) {
	"use strict";
	
	const titleElem = document.getElementsByTagName("h1")[0];
	titleElem.innerHTML = "accentjiten [beta]<br><br>読み込み中...<br>Loading...";
	
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
	
	let searchResultsConjugations;
	
	mainScope.processSearchResultConjugations = processSearchResultConjugations;
	
	function handleWorkerResponse(data) {
		switch (data.name) {
			
			case "loadsuccess": {
				titleElem.innerHTML = "accentjiten [beta]";
				const inputDiv = document.createElement("div");
				inputDiv.setAttribute("class", "search-bar");
				const input = document.createElement("input");
				input.setAttribute("type", "text");
				input.setAttribute("placeholder", "単語を検索 - Search...");
				input.setAttribute("tabindex", "0");
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
				document.addEventListener("keydown", (event) => {
					if (!event.altKey && !event.ctrlKey && !event.isComposing
							&& document.activeElement !== input && event.key === '/') {
						input.focus();
						input.setSelectionRange(input.value.length, input.value.length);
						event.preventDefault();
					}
				});
				input.focus();
				break;
			}
			
			case "loaderror": {
				titleElem.innerHTML = "accentjiten [beta]<br><br>Error";
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
							searchResultsConjugations = [];
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
								
								const conjugations = entry.conjugations;
								if (conjugations) {
									searchResultsConjugations.push(
										{entryElem: entryElem, conjugations: conjugations});
									processSearchResultConjugations(searchResultsConjugations.length - 1, true);
								}
								
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
		
		const midashigoSpan = document.createElement("span");
		midashigoSpan.textContent = midashigo;
		const midashigoElem = document.createElement("span");
		midashigoElem.setAttribute("class", "entry-title");
		midashigoElem.appendChild(midashigoSpan);
		const midashigoTd = document.createElement("td");
		midashigoTd.appendChild(midashigoElem);
		mainTableTr.appendChild(midashigoTd);
		
		const pronunciationTable = document.createElement("table");
		
		for (let i = 0; i < pronunciations.length; i++) {
			const pronunciation = pronunciations[i];
			const sources = pronunciation.sources;
			
			const subtable = document.createElement("table");
			const subtableTr = document.createElement("tr");
			const tableTr = document.createElement("tr");
			
			const pronunciationElem = createAccentElem(pronunciation.accent, pronunciation.tokenizedKana);
			const pronunciationTd = document.createElement("td");
			pronunciationTd.setAttribute("class", "data-content");
			pronunciationTd.appendChild(pronunciationElem);
			
			const sourcesCounterElem = document.createElement("span");
			sourcesCounterElem.setAttribute("class", "source-counter");
			sourcesCounterElem.textContent = "×" + sources.length;
			const sourcesCounterTd = document.createElement("td");
			sourcesCounterTd.appendChild(sourcesCounterElem);
			
			const sourcesElem = document.createElement("span");
			sourcesElem.setAttribute("class", "sources");
			sourcesElem.textContent = " " + sources.join(", ");
			const sourcesElemTd = document.createElement("td");
			sourcesElemTd.appendChild(sourcesElem);
			
			subtable.appendChild(subtableTr);
			
			subtableTr.appendChild(pronunciationTd);
			subtableTr.appendChild(sourcesCounterTd);
			subtableTr.appendChild(sourcesElemTd);
			
			tableTr.appendChild(subtableTr);
			
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
	
	function processSearchResultConjugations(index, initializing) {
		const obj = searchResultsConjugations[index];
		const entryElem = obj.entryElem;
		const conjugations = obj.conjugations;
		
		const isVerb = conjugations.length == 11;
		const btnTextShow = isVerb
			? "活用形を表示 - Show conjugation▼"
			: "活用形を表示 - Show inflection▼";
		const btnTextHide = isVerb
			? "活用形を非表示 - Hide conjugation▲"
			: "活用形を非表示 - Hide inflection▲";
		
		if (initializing && !obj.btnElem) {
			const btnElem = document.createElement("a");
			btnElem.setAttribute("class", "conj-button");
			btnElem.setAttribute("role", "button");
			btnElem.setAttribute("tabindex", "0");
			btnElem.setAttribute("href", "#");
			btnElem.setAttribute("onclick", "javascript:;");
			btnElem.onclick = () => { processSearchResultConjugations(index); return false; }
			btnElem.textContent = btnTextShow;
			obj.btnElem = btnElem;
			obj.collapsed = true;
			entryElem.appendChild(btnElem);
		} else {
			const btnElem = obj.btnElem;
			const collapsed = obj.collapsed;
			
			if (collapsed) {
				btnElem.textContent = btnTextHide;
				obj.collapsed = false;
				
				const headers = isVerb
					? [ "～ます形", "～て形", "～た形", "～ない形", "～なかった形", "～ば形",
						"使役形", "受身形", "命令形", "可能形", "～う形" ]
					: [ "～いです形", "～くて形", "～かった形", "～くない形", "～くなかった形",
						"～ければ形", "～。形", "く形" ];
				
				const tableElem = document.createElement("table");
				tableElem.setAttribute("class", "conj-table");
				
				const sourceTr = document.createElement("tr");
				const sourceTd = document.createElement("td");
				sourceTd.setAttribute("class", "sources");
				sourceTr.setAttribute("style", "text-align:center;border-top:none;border-left:none;border-right:none;");
				sourceTd.setAttribute("style", "text-align:center;border-top:none;border-left:none;border-right:none;");
				sourceTd.setAttribute("colspan", "2");
				sourceTd.textContent = "(OJAD)";
				sourceTr.appendChild(sourceTd);
				tableElem.appendChild(sourceTr);
				
				for (let i = 0; i < headers.length; i++) {
					const header = headers[i];
					const conjugation = conjugations[i];
					
					const conjugationTr = document.createElement("tr");
					
					const headerTd = document.createElement("td");
					headerTd.textContent = headers[i];
					conjugationTr.appendChild(headerTd);
					
					const conjugationTd = document.createElement("td");
					const subtable = document.createElement("table");
					for (const pronunciation of conjugation) {
						const pronunciationElem =
							createAccentElem(pronunciation.accent, pronunciation.tokenizedKana);
						const pronunciationTr = document.createElement("tr");
						pronunciationTr.appendChild(pronunciationElem);
						subtable.appendChild(pronunciationTr);
					}
					conjugationTd.appendChild(subtable);
					conjugationTr.appendChild(conjugationTd);
					tableElem.appendChild(conjugationTr);
				}
				obj.tableElem = tableElem;
				entryElem.appendChild(tableElem);
				
			} else {
				if (obj.tableElem && entryElem.contains(obj.tableElem)) {
					entryElem.removeChild(obj.tableElem);
				}
				btnElem.textContent = btnTextShow;
				obj.collapsed = true;
			}
		}
		
	}
	
}
