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
	
	let introDesc = document.createElement("p");
	introDesc.innerHTML = "日本語アクセント辞典<br>使い方：入力で単語を検索する<br><br>" +
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
	const QUERY_MAX_LENGTH = 50;
	const MAX_ENTRY_ELEMS = 500;
	const H_CHARCODE = "H".charCodeAt(0);
	
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
									let accentI = 0;
									const tokens = pronunciation.tokenizedKana;
									for (let i = 0; i < tokens.length; i++) {
										const token = tokens[i];
										const nextToken = tokens[i + 1];
										const tokenIsHigh = accent.charCodeAt(
											accentI === accent.length - 2 ? accent.length - 1 : accentI)
												=== H_CHARCODE;
										const nextTokenIsHigh =
											!nextToken ? accent.charCodeAt(accent.length - 1) === H_CHARCODE :
												nextToken.type !== "mora" ? tokenIsHigh :
													accent.charCodeAt(accentI === accent.length - 3
														? accent.length - 1 :
															token.type === "mora" ? accentI + 1 : accentI)
																=== H_CHARCODE;
										
										const tokenElem = document.createElement("span");
										tokenElem.textContent = token.value;
										tokenElem.className = tokenIsHigh
											? nextTokenIsHigh ? "hightone" : "hightonenextlow"
											: nextTokenIsHigh ? "lowtonenexthigh" : "lowtone"
										div.appendChild(tokenElem);
										
										if (token.type === "mora") {
											accentI += 1;
										}
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
}