/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024 accentjiten

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
			
			const fileInfo = {
				url: "accentjiten-80.dat.lzma",
				keyName: "accentjiten.dat.lzma",
				version: "80",
				uncompressedSize: 16317316
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
			const syllableFormPoolOffset = 3 + (entryArrayLength * 3 * 3);
			
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
					nResults: nExactMatches + nNonExactMatches,
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
			return { word: word, pronunciations: pronunciations };
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
			const sourceArray = AJ.sourceArray_toObject(data, sourceArrayOffset);
			return {
				accent: accent,
				kana: syllableArray.map(x => x.value).join(""),
				tokenizedKana: syllableArray,
				sources: sourceArray
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
					case 1: array[i] = "Wadoku"; break;
					case 2: array[i] = "OJAD"; break;
					case 3: array[i] = "Wiktionary"; break;
					case 4: array[i] = "NHK"; break;
					case 5: array[i] = "Kanjium"; break;
					case 6: array[i] = "Kishimoto Tsuneyo"; break;
				}
			}
			return array;
		}
		
		static matchWordVariants(data, entryOffset, query) {
			const stringArrayOffset = AJ.entry_getWordVariants_stringArrayOffset(data, entryOffset);
			const stringArrayLength = AJ.stringArray_getLength(data, stringArrayOffset);
			let anyNonExactMatch = false;
			for (let i = 0; i < stringArrayLength; i++) {
				const stringOffset = AJ.stringArray_getString_stringOffset(data, stringArrayOffset, i);
				const match = AJ.matchWordVariant(data, stringOffset, query);
				switch (match) {
					case AJ.NO_MATCH: break;
					case AJ.EXACT_MATCH: return AJ.EXACT_MATCH;
					case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJ.NON_EXACT_MATCH : AJ.NO_MATCH;
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
		
		static createSyllableTrie(syllableFormPool, query) {
			const formattedQuery = query.replace(/\s/g, "").toUpperCase();
			
			const nodes = new Array(formattedQuery.length);
			for (let i = 0; i < formattedQuery.length; i++)
				nodes[i] = { children: { }, isLeaf: false, isCompleteMatchLeaf: false };
			
			for (let i = 0; i < formattedQuery.length; i++) {
				const node = nodes[i];
				const nodeChildren = node.children;
				for (let j = 0; j < syllableFormPool.length; j++) {
					const syllableForm = syllableFormPool[j];
					const childNodes = new Set();
					for (const substring of syllableForm.romaji) {
						const substringMatch = AJ.matchSubstring(formattedQuery, i, substring);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					{
						const hiraganaSyllable = syllableForm.hiraganaSyllable;
						const substringMatch = AJ.matchSubstring(formattedQuery, i, hiraganaSyllable);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					{
						const katakanaSyllable = syllableForm.katakanaSyllable;
						const substringMatch = AJ.matchSubstring(formattedQuery, i, katakanaSyllable);
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
			
			return nodes;
		}
		
		static matchSubstring(query, index, substring) {
			for (let i = 0; i < substring.length; i++) {
				if (index + i >= query.length) return { nMatchedChars: i, isCompleteMatch: false };
				if (query.charAt(index + i) !== substring.charAt(i)) return null;
			}
			return { nMatchedChars: substring.length, isCompleteMatch: true };
		}
		
		static matchSyllables(data, syllablePool, entryOffset, syllableTrie) {
			const nodes = syllableTrie;
			if (nodes.length === 0) return AJ.NO_MATCH;
			const syllableArrayArrayOffset = AJ.entry_getReadings_syllableArrayArrayOffset(data, entryOffset);
			const syllableArrayArrayLength = AJ.syllableArrayArray_getLength(data, syllableArrayArrayOffset);
			let anyNonExactMatch = false;
			for (let i = 0; i < syllableArrayArrayLength; i++) {
				const syllableArrayOffset =
					AJ.syllableArrayArray_getSyllableArray_syllableArrayOffset(data, syllableArrayArrayOffset, i);
				const syllableArrayLength = AJ.syllableArray_getLength(data, syllableArrayOffset);
				const match = AJ.matchSyllablesRecursive(
					data, syllablePool, nodes[0], syllableArrayOffset, 0, syllableArrayLength);
				switch (match) {
					case AJ.NO_MATCH: break;
					case AJ.EXACT_MATCH: return AJ.EXACT_MATCH;
					case AJ.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
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
		
		static getUint8At(dataView, pos) {
			return dataView.getUint8(pos);
		}
		
		static getUint16At(dataView, pos) {
			return dataView.getUint16(pos);
		}
		
		static getUint24At(dataView, pos) {
			return (dataView.getUint16(pos) << 8) | dataView.getUint8(pos + 2);
		}
		
		static getStringAt(dataView, pos) {
			const len = dataView.getUint8(pos);
			const chars = [];
			for (let i = 0; i < len; i++) {
				const charCode = dataView.getUint16((pos + 1) + (i * 2));
				chars.push(String.fromCharCode(charCode));
			}
			return chars.join("");
		}
		
		static entryArray_getLength(dataView) {
			return AJ.getUint24At(dataView, 0);
		}
		
		static entryArray_getEntry_entryOffset(dataView, index) {
			return 3 + (index * 3 * 3);
		}
		
		static entry_getWordVariants_stringArrayOffset(dataView, entryOffset) {
			return AJ.getUint24At(dataView, entryOffset);
		}
		
		static entry_getReadings_syllableArrayArrayOffset(dataView, entryOffset) {
			return AJ.getUint24At(dataView, entryOffset + 3);
		}
		
		static entry_getPronunciations_pronunciationArrayOffset(dataView, entryOffset) {
			return AJ.getUint24At(dataView, entryOffset + 6);
		}
		
		static stringArray_getLength(dataView, stringArrayOffset) {
			return AJ.getUint8At(dataView, stringArrayOffset);
		}
		
		static stringArray_getString_stringOffset(dataView, stringArrayOffset, index) {
			return AJ.getUint24At(dataView, (stringArrayOffset + 1) + (index * 3));
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
			return AJ.getUint24At(dataView, (syllableArrayArrayOffset + 1) + (index * 3));
		}
		
		static syllableArray_getLength(dataView, syllableArrayOffset) {
			return AJ.getUint8At(dataView, syllableArrayOffset);
		}
		
		static syllableArray_getSyllable_syllablePoolIndex(dataView, syllableArrayOffset, index) {
			return AJ.getUint16At(dataView, (syllableArrayOffset + 1) + (index * 2));
		}
		
		static pronunciationArray_getLength(dataView, pronunciationArrayOffset) {
			return AJ.getUint8At(dataView, pronunciationArrayOffset);
		}
		
		static pronunciationArray_getPronunciation_pronunciationOffset(dataView, pronunciationArrayOffset, index) {
			return AJ.getUint24At(dataView, (pronunciationArrayOffset + 1) + (index * 3));
		}
		
		static pronunciation_getReading_syllableArrayOffset(dataView, pronunciationOffset) {
			return AJ.getUint24At(dataView, pronunciationOffset);
		}
		
		static pronunciation_getAccent_stringOffset(dataView, pronunciationOffset) {
			return AJ.getUint24At(dataView, pronunciationOffset + 3);
		}
		
		static pronunciation_getSources_sourceArrayOffset(dataView, pronunciationOffset) {
			return AJ.getUint24At(dataView, pronunciationOffset + 6);
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





/*

https://github.com/jcmellado/js-lzma

Copyright (c) 2011 Juan Mellado

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

References:
- "LZMA SDK" by Igor Pavlov
  http://www.7-zip.org/sdk.html
- "The .lzma File Format" from xz documentation
  https://github.com/joachimmetz/xz/blob/master/doc/lzma-file-format.txt

*/
var LZMA=LZMA||{};!function(e){"use strict";e.OutWindow=function(){this._windowSize=0},e.OutWindow.prototype.create=function(e){this._buffer&&this._windowSize===e||(this._buffer=new Uint8Array(e)),this._windowSize=e,this._pos=0,this._streamPos=0},e.OutWindow.prototype.flush=function(){var e=this._pos-this._streamPos;if(0!==e){if(this._stream.writeBytes)this._stream.writeBytes(this._buffer,e);else for(var t=0;t<e;t++)this._stream.writeByte(this._buffer[t]);this._pos>=this._windowSize&&(this._pos=0),this._streamPos=this._pos}},e.OutWindow.prototype.releaseStream=function(){this.flush(),this._stream=null},e.OutWindow.prototype.setStream=function(e){this.releaseStream(),this._stream=e},e.OutWindow.prototype.init=function(e){e||(this._streamPos=0,this._pos=0)},e.OutWindow.prototype.copyBlock=function(e,t){var i=this._pos-e-1;for(i<0&&(i+=this._windowSize);t--;)i>=this._windowSize&&(i=0),this._buffer[this._pos++]=this._buffer[i++],this._pos>=this._windowSize&&this.flush()},e.OutWindow.prototype.putByte=function(e){this._buffer[this._pos++]=e,this._pos>=this._windowSize&&this.flush()},e.OutWindow.prototype.getByte=function(e){var t=this._pos-e-1;return t<0&&(t+=this._windowSize),this._buffer[t]},e.RangeDecoder=function(){},e.RangeDecoder.prototype.setStream=function(e){this._stream=e},e.RangeDecoder.prototype.releaseStream=function(){this._stream=null},e.RangeDecoder.prototype.init=function(){var e=5;for(this._code=0,this._range=-1;e--;)this._code=this._code<<8|this._stream.readByte()},e.RangeDecoder.prototype.decodeDirectBits=function(e){for(var t,i=0,o=e;o--;)this._range>>>=1,t=this._code-this._range>>>31,this._code-=this._range&t-1,i=i<<1|1-t,(4278190080&this._range)==0&&(this._code=this._code<<8|this._stream.readByte(),this._range<<=8);return i},e.RangeDecoder.prototype.decodeBit=function(e,t){var i=e[t],o=(this._range>>>11)*i;return(2147483648^this._code)<(2147483648^o)?(this._range=o,e[t]+=2048-i>>>5,(4278190080&this._range)==0&&(this._code=this._code<<8|this._stream.readByte(),this._range<<=8),0):(this._range-=o,this._code-=o,e[t]-=i>>>5,(4278190080&this._range)==0&&(this._code=this._code<<8|this._stream.readByte(),this._range<<=8),1)},e.initBitModels=function(e,t){for(;t--;)e[t]=1024},e.BitTreeDecoder=function(e){this._models=[],this._numBitLevels=e},e.BitTreeDecoder.prototype.init=function(){e.initBitModels(this._models,1<<this._numBitLevels)},e.BitTreeDecoder.prototype.decode=function(e){for(var t=1,i=this._numBitLevels;i--;)t=t<<1|e.decodeBit(this._models,t);return t-(1<<this._numBitLevels)},e.BitTreeDecoder.prototype.reverseDecode=function(e){for(var t,i=1,o=0,r=0;r<this._numBitLevels;++r)t=e.decodeBit(this._models,i),i=i<<1|t,o|=t<<r;return o},e.reverseDecode2=function(e,t,i,o){for(var r,s=1,d=0,n=0;n<o;++n)r=i.decodeBit(e,t+s),s=s<<1|r,d|=r<<n;return d},e.LenDecoder=function(){this._choice=[],this._lowCoder=[],this._midCoder=[],this._highCoder=new e.BitTreeDecoder(8),this._numPosStates=0},e.LenDecoder.prototype.create=function(t){for(;this._numPosStates<t;++this._numPosStates)this._lowCoder[this._numPosStates]=new e.BitTreeDecoder(3),this._midCoder[this._numPosStates]=new e.BitTreeDecoder(3)},e.LenDecoder.prototype.init=function(){var t=this._numPosStates;for(e.initBitModels(this._choice,2);t--;)this._lowCoder[t].init(),this._midCoder[t].init();this._highCoder.init()},e.LenDecoder.prototype.decode=function(e,t){return 0===e.decodeBit(this._choice,0)?this._lowCoder[t].decode(e):0===e.decodeBit(this._choice,1)?8+this._midCoder[t].decode(e):16+this._highCoder.decode(e)},e.Decoder2=function(){this._decoders=[]},e.Decoder2.prototype.init=function(){e.initBitModels(this._decoders,768)},e.Decoder2.prototype.decodeNormal=function(e){var t=1;do t=t<<1|e.decodeBit(this._decoders,t);while(t<256);return 255&t},e.Decoder2.prototype.decodeWithMatchByte=function(e,t){var i,o,r=1;do if(i=t>>7&1,t<<=1,o=e.decodeBit(this._decoders,(1+i<<8)+r),r=r<<1|o,i!==o){for(;r<256;)r=r<<1|e.decodeBit(this._decoders,r);break}while(r<256);return 255&r},e.LiteralDecoder=function(){},e.LiteralDecoder.prototype.create=function(t,i){var o;if(!this._coders||this._numPrevBits!==i||this._numPosBits!==t)for(this._numPosBits=t,this._posMask=(1<<t)-1,this._numPrevBits=i,this._coders=[],o=1<<this._numPrevBits+this._numPosBits;o--;)this._coders[o]=new e.Decoder2},e.LiteralDecoder.prototype.init=function(){for(var e=1<<this._numPrevBits+this._numPosBits;e--;)this._coders[e].init()},e.LiteralDecoder.prototype.getDecoder=function(e,t){return this._coders[((e&this._posMask)<<this._numPrevBits)+((255&t)>>>8-this._numPrevBits)]},e.Decoder=function(){this._outWindow=new e.OutWindow,this._rangeDecoder=new e.RangeDecoder,this._isMatchDecoders=[],this._isRepDecoders=[],this._isRepG0Decoders=[],this._isRepG1Decoders=[],this._isRepG2Decoders=[],this._isRep0LongDecoders=[],this._posSlotDecoder=[],this._posDecoders=[],this._posAlignDecoder=new e.BitTreeDecoder(4),this._lenDecoder=new e.LenDecoder,this._repLenDecoder=new e.LenDecoder,this._literalDecoder=new e.LiteralDecoder,this._dictionarySize=-1,this._dictionarySizeCheck=-1,this._posSlotDecoder[0]=new e.BitTreeDecoder(6),this._posSlotDecoder[1]=new e.BitTreeDecoder(6),this._posSlotDecoder[2]=new e.BitTreeDecoder(6),this._posSlotDecoder[3]=new e.BitTreeDecoder(6)},e.Decoder.prototype.setDictionarySize=function(e){return!(e<0)&&(this._dictionarySize!==e&&(this._dictionarySize=e,this._dictionarySizeCheck=Math.max(this._dictionarySize,1),this._outWindow.create(Math.max(this._dictionarySizeCheck,4096))),!0)},e.Decoder.prototype.setLcLpPb=function(e,t,i){var o=1<<i;return!(e>8)&&!(t>4)&&!(i>4)&&(this._literalDecoder.create(t,e),this._lenDecoder.create(o),this._repLenDecoder.create(o),this._posStateMask=o-1,!0)},e.Decoder.prototype.setProperties=function(e){if(!this.setLcLpPb(e.lc,e.lp,e.pb))throw Error("Incorrect stream properties");if(!this.setDictionarySize(e.dictionarySize))throw Error("Invalid dictionary size")},e.Decoder.prototype.decodeHeader=function(e){var t,i,o,r,s,d;return!(e.size<13)&&(i=(t=e.readByte())%9,o=(t=~~(t/9))%5,r=~~(t/5),d=e.readByte(),d|=e.readByte()<<8,d|=e.readByte()<<16,d+=16777216*e.readByte(),s=e.readByte(),s|=e.readByte()<<8,s|=e.readByte()<<16,s+=16777216*e.readByte(),e.readByte(),e.readByte(),e.readByte(),e.readByte(),{lc:i,lp:o,pb:r,dictionarySize:d,uncompressedSize:s})},e.Decoder.prototype.init=function(){var t=4;for(this._outWindow.init(!1),e.initBitModels(this._isMatchDecoders,192),e.initBitModels(this._isRep0LongDecoders,192),e.initBitModels(this._isRepDecoders,12),e.initBitModels(this._isRepG0Decoders,12),e.initBitModels(this._isRepG1Decoders,12),e.initBitModels(this._isRepG2Decoders,12),e.initBitModels(this._posDecoders,114),this._literalDecoder.init();t--;)this._posSlotDecoder[t].init();this._lenDecoder.init(),this._repLenDecoder.init(),this._posAlignDecoder.init(),this._rangeDecoder.init()},e.Decoder.prototype.decodeBody=function(t,i,o){var r,s,d,n,c,h,a=0,p=0,u=0,D=0,$=0,f=0,B=0;for(this._rangeDecoder.setStream(t),this._outWindow.setStream(i),this.init();o<0||f<o;)if(r=f&this._posStateMask,0===this._rangeDecoder.decodeBit(this._isMatchDecoders,(a<<4)+r))s=this._literalDecoder.getDecoder(f++,B),B=a>=7?s.decodeWithMatchByte(this._rangeDecoder,this._outWindow.getByte(p)):s.decodeNormal(this._rangeDecoder),this._outWindow.putByte(B),a=a<4?0:a-(a<10?3:6);else{if(1===this._rangeDecoder.decodeBit(this._isRepDecoders,a))d=0,0===this._rangeDecoder.decodeBit(this._isRepG0Decoders,a)?0===this._rangeDecoder.decodeBit(this._isRep0LongDecoders,(a<<4)+r)&&(a=a<7?9:11,d=1):(0===this._rangeDecoder.decodeBit(this._isRepG1Decoders,a)?n=u:(0===this._rangeDecoder.decodeBit(this._isRepG2Decoders,a)?n=D:(n=$,$=D),D=u),u=p,p=n),0===d&&(d=2+this._repLenDecoder.decode(this._rangeDecoder,r),a=a<7?8:11);else if($=D,D=u,u=p,d=2+this._lenDecoder.decode(this._rangeDecoder,r),a=a<7?7:10,(c=this._posSlotDecoder[d<=5?d-2:3].decode(this._rangeDecoder))>=4){if(h=(c>>1)-1,p=(2|1&c)<<h,c<14)p+=e.reverseDecode2(this._posDecoders,p-c-1,this._rangeDecoder,h);else if(p+=this._rangeDecoder.decodeDirectBits(h-4)<<4,(p+=this._posAlignDecoder.reverseDecode(this._rangeDecoder))<0){if(-1===p)break;return!1}}else p=c;if(p>=f||p>=this._dictionarySizeCheck)return!1;this._outWindow.copyBlock(p,d),f+=d,B=this._outWindow.getByte(0)}return this._outWindow.flush(),this._outWindow.releaseStream(),this._rangeDecoder.releaseStream(),!0},e.Decoder.prototype.setDecoderProperties=function(e){var t,i,o,r,s;return!(e.size<5)&&(i=(t=e.readByte())%9,o=(t=~~(t/9))%5,r=~~(t/5),!!this.setLcLpPb(i,o,r)&&(s=e.readByte(),s|=e.readByte()<<8,s|=e.readByte()<<16,s+=16777216*e.readByte(),this.setDictionarySize(s)))},e.decompress=function(t,i,o,r){var s=new e.Decoder;if(!s.setDecoderProperties(t))throw Error("Incorrect lzma stream properties");if(!s.decodeBody(i,o,r))throw Error("Error in lzma data stream");return o},e.decompressFile=function(t,i){t instanceof ArrayBuffer&&(t=new e.iStream(t)),!i&&e.oStream&&(i=new e.oStream);var o=new e.Decoder,r=o.decodeHeader(t),s=r.uncompressedSize;if(o.setProperties(r),!o.decodeBody(t,i,s))throw Error("Error in lzma data stream");return i},e.decode=e.decompressFile}(LZMA);
