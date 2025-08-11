/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024-2025 accentjiten

*/

onmessage = (event) => {
	"use strict";
	
	const data = event.data;
	switch (data.name) {
		
		case "loadstart": {
			try {
				AccentJiten.load().then(
					() => {
						postMessage({name: "loadsuccess"});
					},
					(error) => {
						console.error(error);
						postMessage({name: "loaderror"});
					}
				);
			} catch (error) {
				console.error(error);
				postMessage({name: "loaderror"});
			}
			break;
		}
		
		case "searchstart": {
			const query = data.query;
			const searchID = data.searchID;
			const results = AccentJiten.resetSearchCoroutine(query, searchID);
			postMessage({name: "searchresults", results: results});
			break;
		}
		
		case "searchcontinue": {
			const results = AccentJiten.continueSearchCoroutine();
			postMessage({name: "searchresults", results: results});
			break;
		}
		
	}
};

var AccentJiten = (() => {
	"use strict";
	
	class AJ {
		
		async load() {
			if (this.initialized) throw new Error();
			
			importScripts("lzma.js");
			
			const fileInfo = {
				url: "accentjiten-107.dat.lzma",
				keyName: "accentjiten.dat.lzma",
				version: "107",
				uncompressedSize: 22490415
			};
			
			const arrayBuffer = await (async function() {
				const lzmaArrayBuffer = await AJ.cacheURL(fileInfo.url, fileInfo.keyName, fileInfo.version);
				const ret = new ArrayBuffer(fileInfo.uncompressedSize);
				const inUint8Array = new Uint8Array(lzmaArrayBuffer);
				const outUint8Array = new Uint8Array(ret);
				let inOffset = 0;
				let outOffset = 0;
				const inStream = { readByte: () => inUint8Array[inOffset++] };
				const outStream = { writeByte: (byte) => { outUint8Array[outOffset++] = byte; } };
				LZMA.decompressFile(inStream, outStream);
				return ret;
			})();
			
			this.data = new DataView(arrayBuffer);
			this.initialize();
			this.initialized = true;
		}
		
		initialize() {
			const data = this.data;
			const entryArrayLength = AJ.entryArray_getLength(data);
			const syllableFormPoolOffset = 4 + (entryArrayLength * 4 * 4);
			
			let pos = syllableFormPoolOffset;
			
			const nSyllableFormPool = AJ.getUint16At(data, pos);
			pos += 2;
			const syllableFormPool = new Array(nSyllableFormPool);
			for (let i = 0; i < nSyllableFormPool; i++) {
				const nHiraganaMoras = AJ.getUint8At(data, pos);
				pos += 1;
				const hiraganaMoras = new Array(nHiraganaMoras);
				for (let j = 0; j < nHiraganaMoras; j++) {
					hiraganaMoras[j] = AJ.getStringAt(data, pos);
					pos += 1 + (hiraganaMoras[j].length * 2);
				}
				
				const nKatakanaMoras = AJ.getUint8At(data, pos);
				pos += 1;
				const katakanaMoras = new Array(nKatakanaMoras);
				for (let j = 0; j < nKatakanaMoras; j++) {
					katakanaMoras[j] = AJ.getStringAt(data, pos);
					pos += 1 + (katakanaMoras[j].length * 2);
				}
				
				const nRomaji = AJ.getUint8At(data, pos);
				pos += 1;
				const romaji = new Array(nRomaji);
				for (let j = 0; j < nRomaji; j++) {
					romaji[j] = AJ.getStringAt(data, pos);
					pos += 1 + (romaji[j].length * 2);
				}
				
				const isPunctuationValue = AJ.getUint8At(data, pos);
				pos += 1;
				const isPunctuation = isPunctuationValue ? true : false;
				
				syllableFormPool[i] = { hiraganaMoras: hiraganaMoras, katakanaMoras: katakanaMoras, romaji: romaji,
					hiraganaSyllable: hiraganaMoras.join(""), katakanaSyllable: katakanaMoras.join(""),
					poolIndex: i, isPunctuation: isPunctuation };
			}
			
			const nSyllablePool = AJ.getUint16At(data, pos);
			pos += 2;
			const syllablePool = new Array(nSyllablePool);
			for (let i = 0; i < nSyllablePool; i++) {
				const syllableFormPoolIndex = AJ.getUint16At(data, pos);
				pos += 2;
				const syllableForm = syllableFormPool[syllableFormPoolIndex];
				const hiraganaOrKatakana = AJ.getUint8At(data, pos);
				pos += 1;
				const syllable = { form: syllableForm, hiraganaOrKatakana: hiraganaOrKatakana, poolIndex: i };
				syllablePool[i] = syllable;
			}
			
			this.syllableFormPool = syllableFormPool;
			this.syllablePool = syllablePool;
			this.exactMatchesArr = new Uint32Array(entryArrayLength);
			this.nonExactMatchesArr = new Uint32Array(entryArrayLength);
		}
		
		static async cacheURL(url, keyName, version) {
			try {
				const dbVersion = await dbGet("version");
				if (dbVersion === version) {
					const arrayBuffer = await dbGet(keyName + "buf");
					console.log("Loaded " + keyName + " version " + version + " from cache");
					return arrayBuffer;
				} else {
					const arrayBuffer = await downloadURL(url);
					await dbReset({[keyName + "buf"]: arrayBuffer, "version": version});
					if (dbVersion) {
						console.log(
							"Downloaded and cached " + keyName + " from version " + dbVersion + " to " + version);
					} else {
						console.log("Downloaded and cached " + keyName + " version " + version);
					}
					return arrayBuffer;
				}
			} catch (error) {
				console.error(error);
				return await downloadURL(url);
			}
			
			async function dbGet(key) {
				return await new Promise((resolve, reject) => {
					const dbRequest = indexedDB.open("aj");
					dbRequest.onerror = (error) => {
						reject(error);
					};
					dbRequest.onsuccess = (event) => {
						const db = event.target.result;
						if (!db.objectStoreNames.contains("aj")) {
							db.close();
							resolve(null);
						} else {
							const valueRequest = db.transaction(["aj"]).objectStore("aj").get(key);
							valueRequest.onerror = (error) => { reject(error); };
							valueRequest.onsuccess = (event) => { 
								const result = event.target.result;
								db.close();
								resolve(result);
							};
						}
					};
				});
			}
			
			async function dbReset(values) {
				await new Promise((resolve, reject) => {
					const request = indexedDB.deleteDatabase("aj");
					request.onerror = (error) => { reject(error); };
					request.onsuccess = (event) => { resolve(); };
				});
				await new Promise((resolve, reject) => {
					const request = indexedDB.open("aj");
					request.onerror = (error) => { reject(error); };
					request.onupgradeneeded = (event) => {
						const db = event.target.result;
						const objectStore = db.createObjectStore("aj");
						for (const key in values) {
							objectStore.put(values[key], key);
						}
						db.close();
						resolve();
					};
				});
			}
			
			async function downloadURL(url) {
				const response = await fetch(url);
				if (!response) throw new Error();
				const ret = await response.arrayBuffer();
				if (!ret) throw new Error();
				return ret;
			}
			
		}
		
		static NO_MATCH = 0;
		static EXACT_MATCH = 1;
		static NON_EXACT_MATCH = 2;
		
		resetSearchCoroutine(query, searchID) {
			const data = this.data;
			this.query = query;
			this.searchID = searchID;
			this.syllableTrie = AJ.createSyllableTrie(this.syllableFormPool, query);
			this.searchIndex = 0;
			this.searching = true;
			this.exactMatchIndex = 0;
			this.nonExactMatchIndex = 0;
			this.nExactMatches = 0;
			this.nNonExactMatches = 0;
			return { searchID: searchID };
		}
		
		continueSearchCoroutine() {
			if (this.searching) {
				const data = this.data;
				const syllablePool = this.syllablePool;
				const query = this.query;
				const syllableTrie = this.syllableTrie;
				const exactMatchesArr = this.exactMatchesArr;
				const nonExactMatchesArr = this.nonExactMatchesArr;
				let nExactMatches = this.nExactMatches;
				let nNonExactMatches = this.nNonExactMatches;
				const entryArrayLength = AJ.entryArray_getLength(data);
				const nMaxIter = 1000;
				
				const fromIndex = this.searchIndex;
				const toIndex = Math.min(fromIndex + nMaxIter, entryArrayLength);
				let i = fromIndex;
				for ( ; i < toIndex; i++) {
					const entryOffset = AJ.entryArray_getEntry_entryOffset(data, i);
					const match1 = AJ.matchWordVariants(data, entryOffset, query);
					if (match1 === AJ.EXACT_MATCH) {
						exactMatchesArr[nExactMatches++] = entryOffset;
					} else {
						const match2 = AJ.matchSyllables(data, syllablePool, entryOffset, syllableTrie);
						switch (match2) {
							case AJ.NO_MATCH:
								if (match1 === AJ.NON_EXACT_MATCH) {
									nonExactMatchesArr[nNonExactMatches++] = entryOffset;
								}
								break;
							case AJ.NON_EXACT_MATCH:
								nonExactMatchesArr[nNonExactMatches++] = entryOffset;
								break;
							case AJ.EXACT_MATCH:
								exactMatchesArr[nExactMatches++] = entryOffset;
								break;
						}
					}
				}
				this.searchIndex = i;
				this.nExactMatches = nExactMatches;
				this.nNonExactMatches = nNonExactMatches;
				
				if (i === entryArrayLength) {
					this.searching = false;
				}
				return { searchID: this.searchID };
			} else {
				const data = this.data;
				const syllablePool = this.syllablePool;
				const exactMatchesArr = this.exactMatchesArr;
				const nonExactMatchesArr = this.nonExactMatchesArr;
				const nExactMatches = this.nExactMatches;
				const nNonExactMatches = this.nNonExactMatches;
				const nMaxResults = 20;
				const results = [];
				let exactMatchIndex = this.exactMatchIndex;
				let nonExactMatchIndex = this.nonExactMatchIndex;
				
				{
					const toIndex = Math.min(exactMatchIndex + nMaxResults - results.length, nExactMatches);
					for ( ; exactMatchIndex < toIndex; exactMatchIndex++) {
						const entryOffset = exactMatchesArr[exactMatchIndex];
						results.push(AJ.entry_toObject(data, syllablePool, entryOffset));
					}
					this.exactMatchIndex = exactMatchIndex;
				}
				
				{
					const toIndex = Math.min(nonExactMatchIndex + nMaxResults - results.length, nNonExactMatches);
					for ( ; nonExactMatchIndex < toIndex; nonExactMatchIndex++) {
						const entryOffset = nonExactMatchesArr[nonExactMatchIndex];
						results.push(AJ.entry_toObject(data, syllablePool, entryOffset));
					}
					this.nonExactMatchIndex = nonExactMatchIndex;
				}
				
				return {
					searchID: this.searchID,
					end: exactMatchIndex === nExactMatches && nonExactMatchIndex === nNonExactMatches,
					nTotalResults: nExactMatches + nNonExactMatches,
					entries: results
				};
			}
		}
		
		static entry_toObject(data, syllablePool, entryOffset) {
			const stringArrayOffset = AJ.entry_getWordVariants_stringArrayOffset(data, entryOffset);
			const stringOffset = AJ.stringArray_getString_stringOffset(data, stringArrayOffset, 0);
			const word = AJ.string_get(data, stringOffset);
			const pronunciationArrayOffset = AJ.entry_getPronunciations_pronunciationArrayOffset(data, entryOffset);
			const pronunciations = AJ.pronunciationArray_toObject(data, syllablePool, pronunciationArrayOffset);
			const conjugationsOffset = AJ.entry_getConjugations_pronunciationArrayArrayOffset(data, entryOffset);
			const conjugations = AJ.pronunciationArrayArray_toObject(data, syllablePool, conjugationsOffset);
			return conjugations.length > 0
				? { word: word, pronunciations: pronunciations, conjugations: conjugations }
				: { word: word, pronunciations: pronunciations };
		}
		
		static pronunciationArrayArray_toObject(data, syllablePool, pronunciationArrayArrayOffset) {
			const pronunciationArrayArrayLength =
				AJ.pronunciationArrayArray_getLength(data, pronunciationArrayArrayOffset);
			const array = new Array(pronunciationArrayArrayLength);
			for (let i = 0; i < pronunciationArrayArrayLength; i++) {
				const pronunciationArrayOffset =
					AJ.pronunciationArrayArray_getPronunciationArray_pronunciationArrayOffset(
						data, pronunciationArrayArrayOffset, i);
				const pronunciationArray =
					AJ.pronunciationArray_toObject(data, syllablePool, pronunciationArrayOffset);
				array[i] = pronunciationArray;
			}
			return array;
		}
		
		static pronunciationArray_toObject(data, syllablePool, pronunciationArrayOffset) {
			const pronunciationArrayLength = AJ.pronunciationArray_getLength(data, pronunciationArrayOffset);
			const array = new Array(pronunciationArrayLength);
			for (let i = 0; i < pronunciationArrayLength; i++) {
				const pronunciationOffset =
					AJ.pronunciationArray_getPronunciation_pronunciationOffset(data, pronunciationArrayOffset, i);
				const pronunciation = AJ.pronunciation_toObject(data, syllablePool, pronunciationOffset);
				array[i] = pronunciation;
			}
			return array;
		}
		
		static pronunciation_toObject(data, syllablePool, pronunciationOffset) {
			const syllableArrayOffset = AJ.pronunciation_getReading_syllableArrayOffset(data, pronunciationOffset);
			const syllableArray = AJ.syllableArray_toObject(data, syllablePool, syllableArrayOffset);
			const stringOffset = AJ.pronunciation_getAccent_stringOffset(data, pronunciationOffset);
			const accent = AJ.string_get(data, stringOffset);
			const sourceArrayOffset = AJ.pronunciation_getSources_sourceArrayOffset(data, pronunciationOffset);
			const sources = AJ.sourceArray_toObject(data, sourceArrayOffset);
			return {
				accent: accent,
				kana: syllableArray.map(x => x.value).join(""),
				tokenizedKana: syllableArray,
				sources: sources
			};
		}
		
		static syllableArray_toObject(data, syllablePool, syllableArrayOffset) {
			const syllableArrayLength = AJ.syllableArray_getLength(data, syllableArrayOffset);
			const array = [];
			for (let i = 0; i < syllableArrayLength; i++) {
				const syllablePoolIndex =
					AJ.syllableArray_getSyllable_syllablePoolIndex(data, syllableArrayOffset, i);
				const syllable = syllablePool[syllablePoolIndex];
				const syllableForm = syllable.form;
				const moras = !syllable.hiraganaOrKatakana ? syllableForm.hiraganaMoras : syllableForm.katakanaMoras;
				const isPunctuation = syllableForm.isPunctuation;
				for (const mora of moras) {
					array.push({type: isPunctuation ? "yakumono" : "mora", value: mora});
				}
			}
			return array;
		}
		
		static sourceArray_toObject(data, sourceArrayOffset) {
			const sourceArrayLength = AJ.sourceArray_getLength(data, sourceArrayOffset);
			const array = new Array(sourceArrayLength);
			for (let i = 0; i < sourceArrayLength; i++) {
				const source = AJ.sourceArray_getSource(data, sourceArrayOffset, i);
				switch (source) {
					case 0: array[i] = "AccentJiten"; break;
					case 1: array[i] = "OJAD"; break;
					case 2: array[i] = "Wiktionary"; break;
					case 3: array[i] = "NHK"; break;
					case 4: array[i] = "Wadoku"; break;
					case 5: array[i] = "Kanjium"; break;
					case 6: array[i] = "Kishimoto Tsuneyo"; break;
				}
			}
			return array;
		}
		
		static matchWordVariants(data, entryOffset, query) {
			query = query.replace(/＊/g, "*");
			query = query.replace(/\*+/g, "*");
			
			const leadingAsterisk = /^\*+/.test(query);
			const trailingAsterisk = /\*+$/.test(query);
			const middleAsterisk = /(?<!^)\*+(?!$)/.test(query);
			
			const wildcard = leadingAsterisk || trailingAsterisk || middleAsterisk;
			
			query = query.replace(/\*/g, "");
			
			const stringArrayOffset = AJ.entry_getWordVariants_stringArrayOffset(data, entryOffset);
			const stringArrayLength = AJ.stringArray_getLength(data, stringArrayOffset);
			let anyNonExactMatch = false;
			
			if (middleAsterisk || (leadingAsterisk && trailingAsterisk)) {
				//todo
			} else if (leadingAsterisk) {
				for (let i = 0; i < stringArrayLength; i++) {
					const stringOffset = AJ.stringArray_getString_stringOffset(data, stringArrayOffset, i);
					const match = AJ.matchWordVariantReverse(data, stringOffset, query);
					switch (match) {
						case AJ.NO_MATCH: break;
						case AJ.EXACT_MATCH: return wildcard ?  AJ.NON_EXACT_MATCH : AJ.EXACT_MATCH;
						case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
					}
				}
				return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
			} else {
				for (let i = 0; i < stringArrayLength; i++) {
					const stringOffset = AJ.stringArray_getString_stringOffset(data, stringArrayOffset, i);
					const match = AJ.matchWordVariant(data, stringOffset, query);
					switch (match) {
						case AJ.NO_MATCH: break;
						case AJ.EXACT_MATCH: return wildcard ?  AJ.NON_EXACT_MATCH : AJ.EXACT_MATCH;
						case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
					}
				}
				return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
			}
		}
		
		static matchWordVariant(data, stringOffset, query) {
			const stringLength = AJ.string_getLength(data, stringOffset);
			const queryLength = query.length;
			for (let i = 0; i < queryLength; i++) {
				if (i >= stringLength) return null;
				const stringCharCode = AJ.string_getCharCode(data, stringOffset, i);
				const queryCharCode = query.charCodeAt(i);
				if (stringCharCode !== queryCharCode) return AJ.NO_MATCH;
			}
			return stringLength === queryLength ? AJ.EXACT_MATCH : AJ.NON_EXACT_MATCH;
		}
		
		static matchWordVariantReverse(data, stringOffset, query) {
			const stringLength = AJ.string_getLength(data, stringOffset);
			const queryLength = query.length;
			for (let i = 0; i < queryLength; i++) {
				if (i >= stringLength) return null;
				const stringCharCode = AJ.string_getCharCode(data, stringOffset, stringLength - 1 - i);
				const queryCharCode = query.charCodeAt(queryLength - 1 - i);
				if (stringCharCode !== queryCharCode) return AJ.NO_MATCH;
			}
			return stringLength === queryLength ? AJ.EXACT_MATCH : AJ.NON_EXACT_MATCH;
		}
		
		static createSyllableTrie(syllableFormPool, query) {
			query = query.replace(/\s/g, "").toUpperCase();
			query = query.replace(/＊/g, "*");
			query = query.replace(/\*+/g, "*");
			
			const leadingAsterisk = /^\*+/.test(query);
			const trailingAsterisk = /\*+$/.test(query);
			const middleAsterisk = /(?<!^)\*+(?!$)/.test(query);
			
			query = query.replace(/\*/g, "");
			
			const nodes = new Array(query.length);
			for (let i = 0; i < query.length; i++) {
				nodes[i] = { children: { }, isLeaf: false, isCompleteMatchLeaf: false };
			}
			
			if (middleAsterisk || (leadingAsterisk && trailingAsterisk)) {
				//todo
				return { nodes: nodes, wildcard: true };
			} else if (leadingAsterisk) {
				for (let i = query.length - 1; i >= 0; i--) {
					const node = nodes[i];
					const nodeChildren = node.children;
					for (let j = 0; j < syllableFormPool.length; j++) {
						const syllableForm = syllableFormPool[j];
						const childNodes = new Set();
						for (const substring of [...syllableForm.romaji,
								syllableForm.hiraganaSyllable, syllableForm.katakanaSyllable]) {
							const substringMatch = AJ.matchSubstringReverse(query, i, substring);
							if (substringMatch) {
								const childNode = i - substringMatch.nMatchedChars >= 0
									? nodes[i - substringMatch.nMatchedChars]
									: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
								childNodes.add(childNode);
							}
						}
						if (childNodes.size > 0) {
							nodeChildren[j] = childNodes;
						}
					}
				}
				return { nodes: nodes, wildcard: true, reverse: true };
			} else {
				for (let i = 0; i < query.length; i++) {
					const node = nodes[i];
					const nodeChildren = node.children;
					for (let j = 0; j < syllableFormPool.length; j++) {
						const syllableForm = syllableFormPool[j];
						const childNodes = new Set();
						for (const substring of [...syllableForm.romaji,
								syllableForm.hiraganaSyllable, syllableForm.katakanaSyllable]) {
							const substringMatch = AJ.matchSubstring(query, i, substring);
							if (substringMatch) {
								const childNode = i + substringMatch.nMatchedChars < nodes.length
									? nodes[i + substringMatch.nMatchedChars]
									: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
								childNodes.add(childNode);
							}
						}
						if (childNodes.size > 0) {
							nodeChildren[j] = childNodes;
						}
					}
				}
				return trailingAsterisk
					? { nodes: nodes, wildcard: true }
					: { nodes: nodes }
			}
		}
		
		static matchSubstring(query, index, substring) {
			for (let i = 0; i < substring.length; i++) {
				if (index + i >= query.length) return { nMatchedChars: i, isCompleteMatch: false };
				if (query.charAt(index + i) !== substring.charAt(i)) return null;
			}
			return { nMatchedChars: substring.length, isCompleteMatch: true };
		}
		
		static matchSubstringReverse(query, index, substring) {
			for (let i = substring.length - 1; i >= 0; i--) {
				if (index - (substring.length - 1 - i) < 0) return { nMatchedChars: substring.length - 1 - i, isCompleteMatch: false };
				if (query.charAt(index - (substring.length - 1 - i)) !== substring.charAt(i)) return null;
			}
			return { nMatchedChars: substring.length, isCompleteMatch: true };
		}
		
		static matchSyllables(data, syllablePool, entryOffset, syllableTrie) {
			const nodes = syllableTrie.nodes;
			const wildcard = syllableTrie.wildcard;
			const reverse = syllableTrie.reverse;
			if (nodes.length === 0) return AJ.NO_MATCH;
			const syllableArrayArrayOffset = AJ.entry_getReadings_syllableArrayArrayOffset(data, entryOffset);
			const syllableArrayArrayLength = AJ.syllableArrayArray_getLength(data, syllableArrayArrayOffset);
			let anyNonExactMatch = false;
			if (!reverse) {
				for (let i = 0; i < syllableArrayArrayLength; i++) {
					const syllableArrayOffset =
						AJ.syllableArrayArray_getSyllableArray_syllableArrayOffset(data, syllableArrayArrayOffset, i);
					const syllableArrayLength = AJ.syllableArray_getLength(data, syllableArrayOffset);
					const match = AJ.matchSyllablesRecursive(
						data, syllablePool, nodes[0], syllableArrayOffset, 0, syllableArrayLength);
					switch (match) {
						case AJ.NO_MATCH: break;
						case AJ.EXACT_MATCH: return wildcard ?  AJ.NON_EXACT_MATCH : AJ.EXACT_MATCH;
						case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
					}
				}
			} else {
				for (let i = syllableArrayArrayLength - 1; i >= 0; i--) {
					const syllableArrayOffset =
						AJ.syllableArrayArray_getSyllableArray_syllableArrayOffset(data, syllableArrayArrayOffset, i);
					const syllableArrayLength = AJ.syllableArray_getLength(data, syllableArrayOffset);
					const match = AJ.matchSyllablesRecursiveReverse(
						data, syllablePool, nodes[nodes.length - 1], syllableArrayOffset, syllableArrayLength - 1);
					switch (match) {
						case AJ.NO_MATCH: break;
						case AJ.EXACT_MATCH: return wildcard ?  AJ.NON_EXACT_MATCH : AJ.EXACT_MATCH;
						case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
					}
				}
			}
			return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
		}
		
		static matchSyllablesRecursive(data, syllablePool, node,
					syllableArrayOffset, syllableArrayIndex, syllableArrayLength) {
			if (syllableArrayIndex >= syllableArrayLength) {
				return AJ.NO_MATCH;
			}
			const syllablePoolIndex =
				AJ.syllableArray_getSyllable_syllablePoolIndex(data, syllableArrayOffset, syllableArrayIndex);
			const syllable = syllablePool[syllablePoolIndex];
			const childNodes = node.children[syllable.form.poolIndex];
			if (!childNodes) {
				return AJ.NO_MATCH;
			}
			let anyNonExactMatch = false;
			for (const childNode of childNodes) {
				const match = !childNode.isLeaf
					? AJ.matchSyllablesRecursive(data, syllablePool, childNode, syllableArrayOffset,
						syllableArrayIndex + 1, syllableArrayLength)
					: childNode.isCompleteMatchLeaf && syllableArrayIndex === syllableArrayLength - 1
						? AJ.EXACT_MATCH : AJ.NON_EXACT_MATCH;
				switch (match) {
					case AJ.NO_MATCH: break;
					case AJ.EXACT_MATCH: return AJ.EXACT_MATCH;
					case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
		}
		
		static matchSyllablesRecursiveReverse(data, syllablePool, node,
					syllableArrayOffset, syllableArrayIndex) {
			if (syllableArrayIndex < 0) {
				return AJ.NO_MATCH;
			}
			const syllablePoolIndex =
				AJ.syllableArray_getSyllable_syllablePoolIndex(data, syllableArrayOffset, syllableArrayIndex);
			const syllable = syllablePool[syllablePoolIndex];
			const childNodes = node.children[syllable.form.poolIndex];
			if (!childNodes) {
				return AJ.NO_MATCH;
			}
			let anyNonExactMatch = false;
			for (const childNode of childNodes) {
				const match = !childNode.isLeaf
					? AJ.matchSyllablesRecursiveReverse(data, syllablePool, childNode, syllableArrayOffset,
						syllableArrayIndex - 1)
					: childNode.isCompleteMatchLeaf && syllableArrayIndex === 0
						? AJ.EXACT_MATCH : AJ.NON_EXACT_MATCH;
				switch (match) {
					case AJ.NO_MATCH: break;
					case AJ.EXACT_MATCH: return AJ.EXACT_MATCH;
					case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
		}
		
		static getUint8At(dataView, pos) {
			return dataView.getUint8(pos);
		}
		
		static getUint16At(dataView, pos) {
			return dataView.getUint16(pos);
		}
		
		static getUint32At(dataView, pos) {
			return dataView.getUint32(pos);
		}
		
		static getStringAt(dataView, pos) {
			const len = dataView.getUint8(pos);
			const chars = new Array(len);
			for (let i = 0; i < len; i++) {
				const charCode = dataView.getUint16((pos + 1) + (i * 2));
				chars[i] = String.fromCharCode(charCode);
			}
			return chars.join("");
		}
		
		static entryArray_getLength(dataView) {
			return AJ.getUint32At(dataView, 0);
		}
		
		static entryArray_getEntry_entryOffset(dataView, index) {
			return 4 + (index * 4 * 4);
		}
		
		static entry_getWordVariants_stringArrayOffset(dataView, entryOffset) {
			return AJ.getUint32At(dataView, entryOffset);
		}
		
		static entry_getReadings_syllableArrayArrayOffset(dataView, entryOffset) {
			return AJ.getUint32At(dataView, entryOffset + 4);
		}
		
		static entry_getPronunciations_pronunciationArrayOffset(dataView, entryOffset) {
			return AJ.getUint32At(dataView, entryOffset + 8);
		}
		
		static entry_getConjugations_pronunciationArrayArrayOffset(dataView, entryOffset) {
			return AJ.getUint32At(dataView, entryOffset + 12);
		}
		
		static stringArray_getLength(dataView, stringArrayOffset) {
			return AJ.getUint8At(dataView, stringArrayOffset);
		}
		
		static stringArray_getString_stringOffset(dataView, stringArrayOffset, index) {
			return AJ.getUint32At(dataView, (stringArrayOffset + 1) + (index * 4));
		}
		
		static string_get(dataView, stringOffset) {
			return AJ.getStringAt(dataView, stringOffset);
		}
		
		static string_getLength(dataView, stringOffset) {
			return AJ.getUint8At(dataView, stringOffset);
		}
		
		static string_getCharCode(dataView, stringOffset, index) {
			return AJ.getUint16At(dataView, (stringOffset + 1) + (index * 2));
		}
		
		static syllableArrayArray_getLength(dataView, syllableArrayArrayOffset) {
			return AJ.getUint8At(dataView, syllableArrayArrayOffset);
		}
		
		static syllableArrayArray_getSyllableArray_syllableArrayOffset(dataView, syllableArrayArrayOffset, index) {
			return AJ.getUint32At(dataView, (syllableArrayArrayOffset + 1) + (index * 4));
		}
		
		static syllableArray_getLength(dataView, syllableArrayOffset) {
			return AJ.getUint8At(dataView, syllableArrayOffset);
		}
		
		static syllableArray_getSyllable_syllablePoolIndex(dataView, syllableArrayOffset, index) {
			return AJ.getUint16At(dataView, (syllableArrayOffset + 1) + (index * 2));
		}
		
		static pronunciationArrayArray_getLength(dataView, pronunciationArrayArrayOffset) {
			return AJ.getUint8At(dataView, pronunciationArrayArrayOffset);
		}
		
		static pronunciationArrayArray_getPronunciationArray_pronunciationArrayOffset(
				dataView, pronunciationArrayArrayOffset, index) {
			return AJ.getUint32At(dataView, (pronunciationArrayArrayOffset + 1) + (index * 4));
		}
		
		static pronunciationArray_getLength(dataView, pronunciationArrayOffset) {
			return AJ.getUint8At(dataView, pronunciationArrayOffset);
		}
		
		static pronunciationArray_getPronunciation_pronunciationOffset(dataView, pronunciationArrayOffset, index) {
			return AJ.getUint32At(dataView, (pronunciationArrayOffset + 1) + (index * 4));
		}
		
		static pronunciation_getReading_syllableArrayOffset(dataView, pronunciationOffset) {
			return AJ.getUint32At(dataView, pronunciationOffset);
		}
		
		static pronunciation_getAccent_stringOffset(dataView, pronunciationOffset) {
			return AJ.getUint32At(dataView, pronunciationOffset + 4);
		}
		
		static pronunciation_getSources_sourceArrayOffset(dataView, pronunciationOffset) {
			return AJ.getUint32At(dataView, pronunciationOffset + 8);
		}
		
		static sourceArray_getLength(dataView, sourceArrayOffset) {
			return AJ.getUint8At(dataView, sourceArrayOffset);
		}
		
		static sourceArray_getSource(dataView, sourceArrayOffset, index) {
			return AJ.getUint8At(dataView, (sourceArrayOffset + 1) + (index));
		}
		
	}
	
	const aj = new AJ();
	return {
		load: async function() { await aj.load(); },
		resetSearchCoroutine: function(query, searchID) { return aj.resetSearchCoroutine(query, searchID); },
		continueSearchCoroutine: function() { return aj.continueSearchCoroutine(); }
	};
	
})();
