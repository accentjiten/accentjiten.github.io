/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024 accentjiten

*/

init().then(
	() => { },
	(error) => {
		console.log(error);
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
	
	let desc = document.createElement("p");
	desc.innerHTML = "日本語アクセント辞典<br>使い方：入力で単語を検索する<br><br>" +
		"Real-time Japanese pitch accent dictionary<br>(How to use: search a word<br>Try typing \"konnichiwa\")";
	
	const searchResults = document.createElement("p");
	let searchResultsChild;
	
	const worker = (() => {
		try {
			const ret = new Worker("accentjiten.worker.js");
			ret.addEventListener("message", (event) => handleWorkerResponse(event.data));
			ret.postMessage({name: "loadstart"});
			return ret;
		} catch (error) {
			console.log(error);
			handleWorkerResponse({name: "loaderror"});
		}
	})();
	
	let searchID = 0;
	let searchQuery;
	let nEntryElems = 0;
	const queryMaxLength = 50;
	const nMaxEntryElems = 500;
	
	function handleWorkerResponse(data) {
		switch (data.name) {
			
			case "loadsuccess": {
				const title = document.createElement("p");
				title.innerHTML = "accentjiten [alpha]";
				document.body.removeChild(loadingMsg);
				document.body.appendChild(title);
				document.body.appendChild(input);
				document.body.appendChild(desc);
				document.body.appendChild(searchResults);
				input.addEventListener("input", (event) => {
					const query = input.value;
					searchID += 1;
					nEntryElems = 0;
					if (query.length === 0) {
						searchQuery = null;
						handleWorkerResponse(
							{name: "searchresults", results: {searchID: searchID, end: true, nResults: 0}});
					} else if (query.length > queryMaxLength) {
						searchQuery = query.substring(0, queryMaxLength) + "...";
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
							if (desc) {
								document.body.removeChild(desc);
								desc = null;
							}
							if (searchResultsChild) {
								searchResults.removeChild(searchResultsChild);
							}
							searchResultsChild = document.createElement("span");
							searchResults.appendChild(searchResultsChild);
							
							if (searchQuery) {
								const descElem = document.createElement("span");
								const descElemChild1 = document.createElement("span");
								if (nResults === 0) {
									descElemChild1.textContent = "何も見つかりませんでした - \"";
								} else if (nResults > nMaxEntryElems) {
									descElemChild1.textContent = nMaxEntryElems + "件を表示中 - \"";
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
								searchResultsChild.appendChild(document.createElement("br"));
								searchResultsChild.appendChild(document.createElement("br"));
							}
						}
						
						for (const entry of entries) {
							const entryElem = document.createElement("span");
							
							const leftBrace = document.createElement("span");
							const rightBrace = document.createElement("span");
							leftBrace.textContent = "「";
							rightBrace.textContent = "」";
							const midashi = document.createElement("span");
							midashi.textContent = entry.word;
							entryElem.appendChild(leftBrace);
							entryElem.appendChild(midashi);
							entryElem.appendChild(rightBrace);
							
							let pronunciationI = 0;
							for (const pronunciation of entry.pronunciations) {
								const div = document.createElement("div");
								div.className = "tonetext";
								const accent = pronunciation.accent;
								let i = 0;
								const len = accent.length - 2;
								for (const token of pronunciation.tokenizedKana) {
									const tokenElem = document.createElement("span");
									tokenElem.textContent = token.value;
									const isMora = token.type === "mora";
									const moraIsHigh = accent.charAt(Math.min(i, len - 1)) === "H";
									if (moraIsHigh) {
										tokenElem.className = "hightone";
									} else if (!isMora && i === 0) {
										tokenElem.className = "lowtone";
									} else {
										const nextMoraChar =
											i + 1 === len ? accent.charAt(i + 2) : accent.charAt(i + 1);
										const prevMoraChar = i < 1 ? null : accent.charAt(i - 1);
										const nextMoraIsHigh = nextMoraChar === "H";
										const prevMoraIsHigh = prevMoraChar === "H";
										if (nextMoraIsHigh && prevMoraIsHigh) {
											tokenElem.className = "lowtonenextandprevioushigh";
										} else if (nextMoraIsHigh) {
											tokenElem.className = "lowtonenexthigh";
										} else if (prevMoraIsHigh) {
											tokenElem.className = "lowtoneprevioushigh";
										} else {
											tokenElem.className = "lowtone";
										}
									}
									div.appendChild(tokenElem);
									if (isMora) {
										i += 1;
									}
								}
								
								if (accent.endsWith("H-L")) {
									const hlElem = document.createElement("span");
									hlElem.className = "lowtoneprevioushigh";
									div.appendChild(hlElem);
								}
								
								entryElem.appendChild(div);
								
								const sourceElem = document.createElement("span");
								sourceElem.setAttribute("style", "vertical-align:middle;");
								const sourceElemChild1 = document.createElement("small");
								sourceElemChild1.setAttribute("style", "color:#999999;");
								const sourceElemChild2 = document.createElement("small");
								sourceElemChild2.textContent = " ×" + pronunciation.sources.length;
								sourceElemChild1.appendChild(sourceElemChild2);
								sourceElem.appendChild(sourceElemChild1);
								entryElem.appendChild(sourceElem);
								
								if (pronunciationI < entry.pronunciations.length - 1) {
									const emSpace = document.createElement("span");
									emSpace.textContent = " ";
									entryElem.appendChild(emSpace);
								}
								pronunciationI += 1;
							}
							
							searchResultsChild.appendChild(entryElem);
							searchResultsChild.appendChild(document.createElement("hr"));
							
							nEntryElems += 1;
							if (nEntryElems === nMaxEntryElems) {
								break;
							}
						}
					}
					
					if (!end && nEntryElems !== nMaxEntryElems) {
						worker.postMessage({name: "searchcontinue"});
					}
				}
				break;
			}
			
		}
	}
}