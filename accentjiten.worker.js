/*

accentjiten - Japanese pitch accent dictionary
https://github.com/accentjiten
Copyright (c) 2024 accentjiten

*/

onmessage = handleMessage;





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





var AccentJiten = (() => {
	"use strict";
	
	class AJ {
		
		loadFromLZMA(arrayBuffer, uncompressedSize) {
			const inUint8Array = new Uint8Array(arrayBuffer);
			let inOffset = 0;
			const inStream = { readByte: () => inUint8Array[inOffset++] };
			
			const outArrayBuffer = new ArrayBuffer(uncompressedSize);
			const outUint8Array = new Uint8Array(outArrayBuffer);
			let outOffset = 0;
			const outStream = { writeByte: (byte) => { outUint8Array[outOffset++] = byte; } };
			
			LZMA.decompressFile(inStream, outStream);
			
			const data = new Uint8Array(outArrayBuffer);
			
			const entryArrayLength = AJD.getIntAt(data, 0);
			const syllableFormPoolOffset = 4 + (entryArrayLength * 12);
			let pos = syllableFormPoolOffset;
			
			const nSyllableFormPool = AJD.getIntAt(data, pos);
			pos += 4;
			const syllableFormPool = new Array(nSyllableFormPool);
			for (let i = 0; i < nSyllableFormPool; i++) {
				const nHiraganaMoras = AJD.getIntAt(data, pos);
				pos += 4;
				const hiraganaMoras = new Array(nHiraganaMoras);
				for (let j = 0; j < nHiraganaMoras; j++) {
					hiraganaMoras[j] = AJD.getStringAt(data, pos);
					pos += 4 + (hiraganaMoras[j].length * 2);
				}
				
				const nKatakanaMoras = AJD.getIntAt(data, pos);
				pos += 4;
				const katakanaMoras = new Array(nKatakanaMoras);
				for (let j = 0; j < nKatakanaMoras; j++) {
					katakanaMoras[j] = AJD.getStringAt(data, pos);
					pos += 4 + (katakanaMoras[j].length * 2);
				}
				
				const nRomaji = AJD.getIntAt(data, pos);
				pos += 4;
				const romaji = new Array(nRomaji);
				for (let j = 0; j < nRomaji; j++) {
					romaji[j] = AJD.getStringAt(data, pos);
					pos += 4 + (romaji[j].length * 2);
				}
				
				const isNakaguro = hiraganaMoras[0] === "・" ? true : false;
				
				syllableFormPool[i] = { hiraganaMoras: hiraganaMoras, katakanaMoras: katakanaMoras, romaji: romaji,
					hiraganaSyllable: hiraganaMoras.join(""), katakanaSyllable: katakanaMoras.join(""),
					poolIndex: i, isNakaguro: isNakaguro };
			}
			
			const nSyllablePool = AJD.getIntAt(data, pos);
			pos += 4;
			const syllablePool = new Array(nSyllablePool);
			for (let i = 0; i < nSyllablePool; i++) {
				const syllableFormPoolIndex = AJD.getIntAt(data, pos);
				pos += 4;
				const syllableForm = syllableFormPool[syllableFormPoolIndex];
				const hiraganaOrKatakana = AJD.getIntAt(data, pos);
				pos += 4;
				const syllable = { form: syllableForm, hiraganaOrKatakana: hiraganaOrKatakana, poolIndex: i };
				syllablePool[i] = syllable;
			}
			
			this.data = data;
			this.syllableFormPool = syllableFormPool;
			this.syllablePool = syllablePool;
			this.exactMatchedEntryOffsetsBuf = new ArrayBuffer(AJD.entryArray_getLength(data) * 4);
			this.exactMatchedEntryOffsetsArr = new Uint32Array(this.exactMatchedEntryOffsetsBuf);
			this.nonExactMatchedEntryOffsetsBuf = new ArrayBuffer(AJD.entryArray_getLength(data) * 4);
			this.nonExactMatchedEntryOffsetsArr = new Uint32Array(this.nonExactMatchedEntryOffsetsBuf);
		}
		
		search(query) {
			AJS.search(this, query);
		}
		
		searchResultsToHTML(query) {
			return AJHTML.searchResultsToHTML(this, query);
		}
		
	}
	
	class AJS {
		
		static NO_MATCH = 0;
		static EXACT_MATCH = 1;
		static NON_EXACT_MATCH = 2;
		
		static search(aj, query) {
			const maxQueryLength = 50;
			
			if (query.length === 0 || query.length > maxQueryLength) {
				if (query.length > maxQueryLength) {
					aj.query = query.substring(0, maxQueryLength) + "...";
				} else {
					aj.query = query;
				}
				aj.exactMatchedEntryOffsetsN = 0;
				aj.nonExactMatchedEntryOffsetsN = 0;
				return;
			}
			
			const data = aj.data;
			const syllableFormPool = aj.syllableFormPool;
			const syllablePool = aj.syllablePool;
			const exactMatchedEntryOffsetsArr = aj.exactMatchedEntryOffsetsArr;
			const nonExactMatchedEntryOffsetsArr = aj.nonExactMatchedEntryOffsetsArr;
			let exactMatchedEntryOffsetsN = 0;
			let nonExactMatchedEntryOffsetsN = 0;
			
			const syllableTrie = AJS.createSyllableTrie(syllableFormPool, query);
			const entryArrayLength = AJD.entryArray_getLength(data);
			for (let i = 0; i < entryArrayLength; i++) {
				const entryOffset = AJD.entryArray_getEntry_entryOffset(data, i);
				const match1 = AJS.matchWordVariants(data, entryOffset, query);
				if (match1 === AJS.EXACT_MATCH) {
					exactMatchedEntryOffsetsArr[exactMatchedEntryOffsetsN++] = entryOffset;
				} else {
					const match2 = AJS.matchSyllables(data, syllablePool, entryOffset, syllableTrie);
					switch (match2) {
						case AJS.NO_MATCH:
							if (match1 === AJS.NON_EXACT_MATCH) {
								nonExactMatchedEntryOffsetsArr[nonExactMatchedEntryOffsetsN++] = entryOffset;
							}
							break;
						case AJS.NON_EXACT_MATCH:
							nonExactMatchedEntryOffsetsArr[nonExactMatchedEntryOffsetsN++] = entryOffset;
							break;
						case AJS.EXACT_MATCH:
							exactMatchedEntryOffsetsArr[exactMatchedEntryOffsetsN++] = entryOffset;
							break;
					}
				}
			}
			
			aj.query = query;
			aj.exactMatchedEntryOffsetsN = exactMatchedEntryOffsetsN;
			aj.nonExactMatchedEntryOffsetsN = nonExactMatchedEntryOffsetsN;
		}
		
		static matchWordVariants(data, entryOffset, query) {
			const stringArrayOffset = AJD.entry_getWordVariants_stringArrayOffset(data, entryOffset);
			const stringArrayLength = AJD.stringArray_getLength(data, stringArrayOffset);
			let anyNonExactMatch = false;
			for (let i = 0; i < stringArrayLength; i++) {
				const stringOffset = AJD.stringArray_getString_stringOffset(data, stringArrayOffset, i);
				const match = AJS.matchWordVariant(data, stringOffset, query);
				switch (match) {
					case AJS.NO_MATCH: break;
					case AJS.EXACT_MATCH: return AJS.EXACT_MATCH;
					case AJS.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJS.NON_EXACT_MATCH : AJS.NO_MATCH;
		}
		
		static matchWordVariant(data, stringOffset, query) {
			const stringLength = AJD.string_getLength(data, stringOffset);
			const queryLength = query.length;
			for (let i = 0; i < queryLength; i++) {
				if (i >= stringLength) return null;
				const stringChar = AJD.string_getChar(data, stringOffset, i);
				const queryChar = query.charCodeAt(i);
				if (stringChar !== queryChar) return AJS.NO_MATCH;
			}
			return stringLength === queryLength ? AJS.EXACT_MATCH : AJS.NON_EXACT_MATCH;
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
						const substringMatch = AJS.matchSubstring(formattedQuery, i, substring);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					{
						const hiraganaSyllable = syllableForm.hiraganaSyllable;
						const substringMatch = AJS.matchSubstring(formattedQuery, i, hiraganaSyllable);
						if (substringMatch) {
							const childNode = i + substringMatch.nMatchedChars < nodes.length
								? nodes[i + substringMatch.nMatchedChars]
								: { children: { }, isLeaf: true, isCompleteMatchLeaf: substringMatch.isCompleteMatch };
							childNodes.add(childNode);
						}
					}
					{
						const katakanaSyllable = syllableForm.katakanaSyllable;
						const substringMatch = AJS.matchSubstring(formattedQuery, i, katakanaSyllable);
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
			if (nodes.length === 0) return 0;
			const syllableArrayArrayOffset = AJD.entry_getReadings_syllableArrayArrayOffset(data, entryOffset);
			const syllableArrayArrayLength = AJD.syllableArrayArray_getLength(data, syllableArrayArrayOffset);
			let anyNonExactMatch = false;
			for (let i = 0; i < syllableArrayArrayLength; i++) {
				const syllableArrayOffset =
					AJD.syllableArrayArray_getSyllableArray_syllableArrayOffset(data, syllableArrayArrayOffset, i);
				const syllableArrayLength = AJD.syllableArray_getLength(data, syllableArrayOffset);
				const match = AJS.matchSyllablesRecursive(
					data, syllablePool, nodes[0], syllableArrayOffset, 0, syllableArrayLength);
				switch (match) {
					case AJS.NO_MATCH: break;
					case AJS.EXACT_MATCH: return AJS.EXACT_MATCH;
					case AJS.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJS.NON_EXACT_MATCH : AJS.NO_MATCH;
		}
		
		static matchSyllablesRecursive(data, syllablePool, node,
					syllableArrayOffset, syllableArrayIndex, syllableArrayLength) {
			if (syllableArrayIndex >= syllableArrayLength) {
				return AJS.NO_MATCH;
			}
			const syllablePoolIndex =
				AJD.syllableArray_getSyllable_syllablePoolIndex(data, syllableArrayOffset, syllableArrayIndex);
			const syllable = syllablePool[syllablePoolIndex];
			const childNodes = node.children[syllable.form.poolIndex];
			if (!childNodes) {
				return AJS.NO_MATCH;
			}
			let anyNonExactMatch = false;
			for (const childNode of childNodes) {
				const match = !childNode.isLeaf
					? AJS.matchSyllablesRecursive(data, syllablePool, childNode, syllableArrayOffset,
						syllableArrayIndex + 1, syllableArrayLength)
					: childNode.isCompleteMatchLeaf && syllableArrayIndex === syllableArrayLength - 1
						? AJS.EXACT_MATCH : AJS.NON_EXACT_MATCH;
				switch (match) {
					case AJS.NO_MATCH: break;
					case AJS.EXACT_MATCH: return AJS.EXACT_MATCH;
					case AJS.NON_EXACT_MATCH: { anyNonExactMatch = true; break; }
				}
			}
			return anyNonExactMatch ? AJS.NON_EXACT_MATCH : AJS.NO_MATCH;
		}
	
	}
	
	class AJHTML {
		
		static searchResultsToHTML(aj) {
			const data = aj.data;
			const syllablePool = aj.syllablePool;
			const query = aj.query;
			const exactMatchedEntryOffsetsArr = aj.exactMatchedEntryOffsetsArr;
			const nonExactMatchedEntryOffsetsArr = aj.nonExactMatchedEntryOffsetsArr;
			const exactMatchedEntryOffsetsN = aj.exactMatchedEntryOffsetsN;
			const nonExactMatchedEntryOffsetsN = aj.nonExactMatchedEntryOffsetsN;
			const maxResults = 500;
			
			let html = "";
			let nEntries = 0;
			const nResults = exactMatchedEntryOffsetsN + nonExactMatchedEntryOffsetsN;
			
			for (let i = 0; i < exactMatchedEntryOffsetsN; i++) {
				if (nEntries >= maxResults) break;
				const entryOffset = exactMatchedEntryOffsetsArr[i];
				html += AJHTML.entryToHTML(data, syllablePool, entryOffset);
				html += "<hr>";
				nEntries++;
			}
			
			for (let i = 0; i < nonExactMatchedEntryOffsetsN; i++) {
				if (nEntries >= maxResults) break;
				const entryOffset = nonExactMatchedEntryOffsetsArr[i];
				html += AJHTML.entryToHTML(data, syllablePool, entryOffset);
				html += "<hr>";
				nEntries++;
			}
			
			let labelHTML;
			if (nResults > maxResults) {
				labelHTML = "全" + nResults + "件中1～" + maxResults + "件を表示中 - \"<b>"
					+ AJHTML.escapeHTML(query) + "</b>\"";
			} else if (nResults === 0) {
				if (query) {
					labelHTML = "何も見つかりませんでした - \"<b>" + AJHTML.escapeHTML(query) + "</b>\"";
				} else {
					labelHTML = "";
				}
			} else {
				labelHTML = nResults + "件 - \"<b>" + AJHTML.escapeHTML(query) + "</b>\"";
			}
			
			return { html1: labelHTML, html2: html };
		}
			
		static entryToHTML(data, syllablePool, entryOffset) {
			let html = "";
			const stringArrayOffset = AJD.entry_getWordVariants_stringArrayOffset(data, entryOffset);
			const stringOffset = AJD.stringArray_getString_stringOffset(data, stringArrayOffset, 0);
			const wordVariant = AJD.string_get(data, stringOffset);
			html += "「";
			html += AJHTML.escapeHTML(wordVariant);
			html += "」";
			const pronunciationArrayOffset = AJD.entry_getPronunciations_pronunciationArrayOffset(data, entryOffset);
			const pronunciationArrayLength = AJD.pronunciationArray_getLength(data, pronunciationArrayOffset);
			for (let i = 0; i < pronunciationArrayLength; i++) {
				const pronunciationOffset =
					AJD.pronunciationArray_getPronunciation_pronunciationOffset(data, pronunciationArrayOffset, i);
				const syllableArrayOffset =
					AJD.pronunciation_getReading_syllableArrayOffset(data, pronunciationOffset);
				const accent = AJD.pronunciation_getAccent(data, pronunciationOffset);
				const sourceArrayOffset = AJD.pronunciation_getSources_sourceArrayOffset(data, pronunciationOffset);
				
				const syllableArrayLength = AJD.syllableArray_getLength(data, syllableArrayOffset);
				html += "<div class=\"tonetext\">";
				let nMora = 0;
				for (let j = 0; j < syllableArrayLength; j++) {
					const syllablePoolIndex =
						AJD.syllableArray_getSyllable_syllablePoolIndex(data, syllableArrayOffset, j);
					const syllable = syllablePool[syllablePoolIndex];
					const syllableForm = syllable.form;
					const isNakaguro = syllableForm.isNakaguro;
					const moras = syllable.hiraganaOrKatakana === 0
						? syllableForm.hiraganaMoras : syllableForm.katakanaMoras;
					for (const mora of moras) {
						if (accent === 0) {
							if (nMora === 0) {
								html += "<span class=\"lowtonenexthigh\">";
							} else {
								html += "<span class=\"hightone\">";
							}
						} else if (accent === 1) {
							if (nMora === 0) {
								html += "<span class=\"hightone\">";
							} else if (nMora === 1) {
								html += "<span class=\"lowtoneprevioushigh\">";
							} else {
								html += "<span class=\"lowtone\">";
							}
						} else {
							if (nMora === 0) {
								html += "<span class=\"lowtonenexthigh\">";
							} else if (nMora === accent) {
								html += "<span class=\"lowtoneprevioushigh\">";
							} else if (nMora < accent) {
								html += "<span class=\"hightone\">";
							} else {
								html += "<span class=\"lowtone\">";
							}
						}
						html += AJHTML.escapeHTML(mora);
						html += "</span>";
						if (!isNakaguro) {
							nMora++;
						}
					}
				}
				if (nMora === accent) {
					html += "<span class=\"lowtoneprevioushigh\"></span>";
				}
				html += "</div>";
				
				const sourceArrayLength = AJD.sourceArray_getLength(data, sourceArrayOffset);
				html += "<span style=\"vertical-align:middle;\"><small style=\"color:#999999;\"><small>";
				html += "&thinsp;×";
				html += sourceArrayLength;
				html += "</small></small></span>";
				if (i !== pronunciationArrayLength - 1) {
					html += "&emsp;";
				}
			}
			return html;
		}

		static escapeHTML(str) {
			return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
				.replaceAll('"', "&quot;").replaceAll("'", "&#039;").replaceAll(" ", "&nbsp;");
		}
		
	}
	
	class AJD {
		
		static getIntAt(uint8Array, pos) {
			const b1 = uint8Array[pos] & 0xFF;
			const b2 = uint8Array[pos + 1] & 0xFF;
			const b3 = uint8Array[pos + 2] & 0xFF;
			const b4 = uint8Array[pos + 3] & 0xFF;
			return ((b1 << 24) + (b2 << 16) + (b3 << 8) + (b4));
		}
		
		static getCharAt(uint8Array, pos) {
			const b1 = uint8Array[pos] & 0xFF;
			const b2 = uint8Array[pos + 1] & 0xFF;
			return ((b1 << 8) + (b2));
		}
		
		static getStringAt(uint8Array, pos) {
			const len = AJD.getIntAt(uint8Array, pos);
			const chars = [];
			for (let i = 0; i < len; i++) {
				const charCode = AJD.getCharAt(uint8Array, (pos + 4) + (i * 2));
				chars.push(String.fromCharCode(charCode));
			}
			return chars.join("");
		}
		
		static entryArray_getLength(uint8Array) {
			return AJD.getIntAt(uint8Array, 0);
		}
		
		static entryArray_getEntry_entryOffset(uint8Array, index) {
			return 4 + (12 * index);
		}
		
		static entry_getWordVariants_stringArrayOffset(uint8Array, entryOffset) {
			return AJD.getIntAt(uint8Array, entryOffset);
		}
		
		static entry_getReadings_syllableArrayArrayOffset(uint8Array, entryOffset) {
			return AJD.getIntAt(uint8Array, entryOffset + 4);
		}
		
		static entry_getPronunciations_pronunciationArrayOffset(uint8Array, entryOffset) {
			return AJD.getIntAt(uint8Array, entryOffset + 8);
		}
		
		static stringArray_getLength(uint8Array, stringArrayOffset) {
			return AJD.getIntAt(uint8Array, stringArrayOffset);
		}
		
		static stringArray_getString_stringOffset(uint8Array, stringArrayOffset, index) {
			return AJD.getIntAt(uint8Array, (stringArrayOffset + 4) + (index * 4));
		}
		
		static string_get(uint8Array, stringOffset) {
			return AJD.getStringAt(uint8Array, stringOffset);
		}
		
		static string_getLength(uint8Array, stringOffset) {
			return AJD.getIntAt(uint8Array, stringOffset);
		}
		
		static string_getChar(uint8Array, stringOffset, index) {
			return AJD.getCharAt(uint8Array, (stringOffset + 4) + (index * 2));
		}
		
		static syllableArrayArray_getLength(uint8Array, syllableArrayArrayOffset) {
			return AJD.getIntAt(uint8Array, syllableArrayArrayOffset);
		}
		
		static syllableArrayArray_getSyllableArray_syllableArrayOffset(uint8Array, syllableArrayArrayOffset, index) {
			return AJD.getIntAt(uint8Array, (syllableArrayArrayOffset + 4) + (index * 4));
		}
		
		static syllableArray_getLength(uint8Array, syllableArrayOffset) {
			return AJD.getIntAt(uint8Array, syllableArrayOffset);
		}
		
		static syllableArray_getSyllable_syllablePoolIndex(uint8Array, syllableArrayOffset, index) {
			return AJD.getIntAt(uint8Array, (syllableArrayOffset + 4) + (index * 4));
		}
		
		static pronunciationArray_getLength(uint8Array, pronunciationArrayOffset) {
			return AJD.getIntAt(uint8Array, pronunciationArrayOffset);
		}
		
		static pronunciationArray_getPronunciation_pronunciationOffset(uint8Array, pronunciationArrayOffset, index) {
			return AJD.getIntAt(uint8Array, (pronunciationArrayOffset + 4) + (index * 4));
		}
		
		static pronunciation_getReading_syllableArrayOffset(uint8Array, pronunciationOffset) {
			return AJD.getIntAt(uint8Array, pronunciationOffset);
		}
		
		static pronunciation_getAccent(uint8Array, pronunciationOffset) {
			return AJD.getIntAt(uint8Array, pronunciationOffset + 4);
		}
		
		static pronunciation_getSources_sourceArrayOffset(uint8Array, pronunciationOffset) {
			return AJD.getIntAt(uint8Array, pronunciationOffset + 8);
		}
		
		static sourceArray_getLength(uint8Array, sourceArrayOffset) {
			return AJD.getIntAt(uint8Array, sourceArrayOffset);
		}
		
		static sourceArray_getSource(uint8Array, sourceArrayOffset, index) {
			return AJD.getIntAt(uint8Array, (sourceArrayOffset + 4) + (index * 4));
		}
		
	}
	
	const aj = new AJ();
	return {
		loadFromLZMA: aj.loadFromLZMA,
		search: aj.search,
		searchResultsToHTML: aj.searchResultsToHTML
	};
	
})();





function handleMessage(event) {
	"use strict";
	
	const data = event.data;
	switch (data.name) {
		case "load": {
			AccentJiten.loadFromLZMA(data.arrayBuffer, data.uncompressedSize);
			postMessage({name: "onload"});
			break;
		}
		case "search": {
			AccentJiten.search(data.query);
			const html = AccentJiten.searchResultsToHTML();
			postMessage({name: "onsearch", html1: html.html1, html2: html.html2});
			break;
		}
	}
	
}