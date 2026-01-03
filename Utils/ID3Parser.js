import RNFS from 'react-native-fs';

/**
 * AudioMetadataParser - Extracts embedded artwork and metadata from audio files
 * 
 * Supports:
 * - MP3 files (ID3v2 tags)
 * - M4A/AAC/MP4 files (MP4 atoms)
 * - FLAC files (Vorbis comments and FLAC metadata blocks)
 * - OGG files (Vorbis comments)
 */
class AudioMetadataParser {

    /**
     * Extract artwork and metadata from an audio file
     * @param {string} filePath - Path to the audio file
     * @returns {Promise<{artwork: {base64: string, mimeType: string}, metadata: object} | null>}
     */
    static async extractMetadata(filePath) {
        try {
            // Check file exists
            const exists = await RNFS.exists(filePath);
            if (!exists) {
                return null;
            }

            // Determine file type
            const extension = filePath.toLowerCase().split('.').pop();

            if (extension === 'mp3') {
                return await this.extractID3Metadata(filePath);
            } else if (['m4a', 'aac', 'mp4', 'm4b', 'm4p'].includes(extension)) {
                return await this.extractM4AMetadata(filePath);
            } else if (extension === 'flac') {
                return await this.extractFLACMetadata(filePath);
            } else if (extension === 'ogg') {
                return await this.extractOGGMetadata(filePath);
            } else {
                return null;
            }

        } catch (error) {
            // Silently handle errors - file might be corrupted or inaccessible
            return null;
        }
    }

    /**
     * Legacy method for backward compatibility - only returns artwork
     */
    static async extractArtwork(filePath) {
        const result = await this.extractMetadata(filePath);
        return result?.artwork || null;
    }

    /**
     * Extract metadata from FLAC files
     * FLAC uses metadata blocks, including VORBIS_COMMENT for tags and PICTURE for artwork
     */
    static async extractFLACMetadata(filePath) {
        try {
            const MAX_READ_SIZE = 2 * 1024 * 1024; // 2MB

            const stats = await RNFS.stat(filePath);
            const readSize = Math.min(stats.size, MAX_READ_SIZE);

            const base64Data = await RNFS.read(filePath, readSize, 0, 'base64');
            const bytes = this.base64ToBytes(base64Data);

            // Check for "fLaC" signature
            if (!(bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43)) {
                return null;
            }

            let offset = 4; // Skip "fLaC"
            let artwork = null;
            let metadata = {};

            // Read metadata blocks
            while (offset < bytes.length - 4) {
                const isLast = (bytes[offset] & 0x80) !== 0;
                const blockType = bytes[offset] & 0x7F;
                const blockLength = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];

                offset += 4;

                if (offset + blockLength > bytes.length) break;

                // VORBIS_COMMENT block (type 4)
                if (blockType === 4) {
                    metadata = this.parseVorbisComments(bytes.slice(offset, offset + blockLength));
                }

                // PICTURE block (type 6)
                if (blockType === 6) {
                    artwork = this.parseFLACPictureBlock(bytes.slice(offset, offset + blockLength));
                }

                offset += blockLength;
                if (isLast) break;
            }

            return { artwork, metadata };

        } catch (error) {
            return null;
        }
    }

    /**
     * Parse FLAC PICTURE metadata block
     */
    static parseFLACPictureBlock(bytes) {
        try {
            let pos = 0;

            // Picture type (4 bytes)
            pos += 4;

            // MIME type length
            const mimeLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;

            // MIME type
            let mimeType = '';
            for (let i = 0; i < mimeLength; i++) {
                mimeType += String.fromCharCode(bytes[pos++]);
            }

            // Description length
            const descLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4 + descLength;

            // Skip width, height, depth, colors (16 bytes)
            pos += 16;

            // Picture data length
            const dataLength = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
            pos += 4;

            if (dataLength > 0 && pos + dataLength <= bytes.length) {
                const imageBytes = bytes.slice(pos, pos + dataLength);
                const base64 = this.bytesToBase64(imageBytes);
                return { base64, mimeType: mimeType || 'image/jpeg' };
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Parse Vorbis comments (used in FLAC and OGG)
     */
    static parseVorbisComments(bytes) {
        try {
            let pos = 0;
            const metadata = {};

            // Vendor string length
            const vendorLength = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24);
            pos += 4 + vendorLength;

            // Number of comments
            const numComments = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24);
            pos += 4;

            for (let i = 0; i < numComments && pos < bytes.length; i++) {
                const commentLength = bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24);
                pos += 4;

                if (pos + commentLength > bytes.length) break;

                let comment = '';
                for (let j = 0; j < commentLength; j++) {
                    comment += String.fromCharCode(bytes[pos++]);
                }

                const [key, ...valueParts] = comment.split('=');
                const value = valueParts.join('=');

                if (key && value) {
                    const normalizedKey = key.toLowerCase();
                    if (normalizedKey === 'artist') metadata.artist = value;
                    else if (normalizedKey === 'album') metadata.album = value;
                    else if (normalizedKey === 'title') metadata.title = value;
                    else if (normalizedKey === 'date' || normalizedKey === 'year') metadata.year = value;
                    else if (normalizedKey === 'genre') metadata.genre = value;
                }
            }

            return metadata;
        } catch (error) {
            return {};
        }
    }

    /**
     * Extract metadata from OGG files
     */
    static async extractOGGMetadata(filePath) {
        // OGG parsing is complex - for now return null
        return null;
    }

    /**
     * Extract metadata from M4A/AAC files
     */
    static async extractM4AMetadata(filePath) {
        try {
            const MAX_READ_SIZE = 2 * 1024 * 1024;

            const stats = await RNFS.stat(filePath);
            const readSize = Math.min(stats.size, MAX_READ_SIZE);

            const base64Data = await RNFS.read(filePath, readSize, 0, 'base64');
            const bytes = this.base64ToBytes(base64Data);

            const artwork = this.findCovrAtom(bytes);
            const metadata = this.findM4AMetadata(bytes);

            return { artwork, metadata };

        } catch (error) {
            return null;
        }
    }

    /**
     * Find M4A metadata atoms (©nam, ©ART, ©alb, etc.)
     */
    static findM4AMetadata(bytes) {
        const metadata = {};

        // Search for metadata atoms
        const atoms = {
            '\xa9nam': 'title',    // ©nam
            '\xa9ART': 'artist',   // ©ART
            '\xa9alb': 'album',    // ©alb
            '\xa9day': 'year',     // ©day
            '\xa9gen': 'genre'     // ©gen
        };

        for (const [atomName, metaKey] of Object.entries(atoms)) {
            const value = this.findM4AAtomValue(bytes, atomName);
            if (value) metadata[metaKey] = value;
        }

        return metadata;
    }

    /**
     * Find specific M4A atom value
     */
    static findM4AAtomValue(bytes, atomName) {
        for (let i = 0; i < bytes.length - 8; i++) {
            if (String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]) === atomName) {
                // Found atom, look for data
                for (let j = i; j < Math.min(i + 200, bytes.length - 16); j++) {
                    if (bytes[j] === 0x64 && bytes[j + 1] === 0x61 && bytes[j + 2] === 0x74 && bytes[j + 3] === 0x61) {
                         const dataSize = (bytes[j - 4] << 24) | (bytes[j - 3] << 16) | (bytes[j - 2] << 8) | bytes[j - 1];
                         const textStart = j + 8; // Skip 'data' + flags
                         const textLength = dataSize - 16;

                        if (textLength > 0 && textStart + textLength <= bytes.length) {
                             // Correctly decode bytes as UTF-8
                             const textBytes = bytes.slice(textStart, textStart + textLength);
                             try {
                                return this.decodeUTF8(textBytes).trim();
                             } catch (e) {
                                let text = '';
                                for (let k = 0; k < textLength; k++) {
                                    if (textBytes[k] > 0) text += String.fromCharCode(textBytes[k]);
                                }
                                return text.trim();
                             }
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Decode UTF-8 bytes to string
     */
    static decodeUTF8(bytes) {
        let result = '';
        let i = 0;
        while (i < bytes.length) {
            const b1 = bytes[i++];
            if (b1 === 0) continue;
            if (b1 < 0x80) result += String.fromCharCode(b1);
            else if (b1 < 0xE0) result += String.fromCharCode(((b1 & 0x1F) << 6) | (bytes[i++] & 0x3F));
            else if (b1 < 0xF0) result += String.fromCharCode(((b1 & 0x0F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F));
            else {
                let cp = ((b1 & 0x07) << 18) | ((bytes[i++] & 0x3F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F);
                cp -= 0x10000;
                result += String.fromCharCode((cp >> 10) + 0xD800, (cp & 0x3FF) + 0xDC00);
            }
        }
        return result;
    }

    /**
     * Find 'covr' atom in MP4 data
     */
    static findCovrAtom(bytes) {
        for (let i = 0; i < bytes.length - 20; i++) {
            if (bytes[i] === 0x63 && bytes[i + 1] === 0x6F && bytes[i + 2] === 0x76 && bytes[i + 3] === 0x72) {
                const covrSize = (bytes[i - 4] << 24) | (bytes[i - 3] << 16) | (bytes[i - 2] << 8) | bytes[i - 1];

                if (covrSize > 8 && covrSize < bytes.length - i + 4) {
                    for (let j = i + 4; j < i + covrSize - 4 && j < bytes.length - 16; j++) {
                        if (bytes[j] === 0x64 && bytes[j + 1] === 0x61 && bytes[j + 2] === 0x74 && bytes[j + 3] === 0x61) {
                            const dataSize = (bytes[j - 4] << 24) | (bytes[j - 3] << 16) | (bytes[j - 2] << 8) | bytes[j - 1];

                            if (dataSize > 16 && dataSize < 5 * 1024 * 1024) {
                                const imageStart = j + 12;
                                const imageSize = dataSize - 16;

                                if (imageStart + imageSize <= bytes.length) {
                                    const imageBytes = bytes.slice(imageStart, imageStart + imageSize);
                                    const base64 = this.bytesToBase64(imageBytes);

                                    let mimeType = 'image/jpeg';
                                    if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50) {
                                        mimeType = 'image/png';
                                    }

                                    return { base64, mimeType };
                                }
                            }
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Extract metadata from MP3 files
     */
    static async extractID3Metadata(filePath) {
        try {
            const MAX_READ_SIZE = 512 * 1024;

            const stats = await RNFS.stat(filePath);
            const readSize = Math.min(stats.size, MAX_READ_SIZE);

            const base64Data = await RNFS.read(filePath, readSize, 0, 'base64');
            const bytes = this.base64ToBytes(base64Data);

            if (!this.hasID3v2Header(bytes)) {
                return null;
            }

            const headerInfo = this.parseID3v2Header(bytes);
            if (!headerInfo) {
                return null;
            }

            const artwork = this.findAPICFrame(bytes, headerInfo);
            const metadata = this.extractID3Frames(bytes, headerInfo);

            return { artwork, metadata };

        } catch (error) {
            return null;
        }
    }

    /**
     * Extract ID3 text frames
     */
    static extractID3Frames(bytes, headerInfo) {
        const metadata = {};
        let offset = headerInfo.headerSize;
        const maxOffset = Math.min(offset + headerInfo.size, bytes.length);

        while (offset < maxOffset - 10) {
            const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);

            if (bytes[offset] === 0x00 || !/^[A-Z0-9]{4}$/.test(frameId)) break;

            let frameSize;
            if (headerInfo.version === 4) {
               frameSize = (bytes[offset + 4] << 21) | (bytes[offset + 5] << 14) | (bytes[offset + 6] << 7) | bytes[offset + 7];
            } else {
               frameSize = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
            }

            const dataOffset = offset + 10;

            if (frameId === 'TIT2') metadata.title = this.extractTextFrame(bytes, dataOffset, frameSize);
            else if (frameId === 'TPE1') metadata.artist = this.extractTextFrame(bytes, dataOffset, frameSize);
            else if (frameId === 'TALB') metadata.album = this.extractTextFrame(bytes, dataOffset, frameSize);
            else if (frameId === 'TYER' || frameId === 'TDRC') metadata.year = this.extractTextFrame(bytes, dataOffset, frameSize);
            else if (frameId === 'TCON') metadata.genre = this.extractTextFrame(bytes, dataOffset, frameSize);

            offset += 10 + frameSize;
        }

        return metadata;
    }

    /**
     * Extract text from ID3 text frame
     */
    static extractTextFrame(bytes, offset, size) {
        try {
            if (size < 2) return null;
            const encoding = bytes[offset];
            const textStart = offset + 1;
            const textEnd = offset + size;

            if (textStart >= bytes.length) return null;

            let text = '';

            if (encoding === 0x00 || encoding === 0x03) {
                // Latin-1 or UTF-8
                for (let i = textStart; i < textEnd && i < bytes.length; i++) {
                    if (bytes[i] === 0) break;
                    text += String.fromCharCode(bytes[i]);
                }
            } else if (encoding === 0x01 || encoding === 0x02) {
                // UTF-16
                let i = textStart;
                let le = false;
                if (encoding === 0x01) {
                    if (bytes[i] === 0xFF && bytes[i+1] === 0xFE) { le = true; i += 2; }
                    else if (bytes[i] === 0xFE && bytes[i+1] === 0xFF) { le = false; i += 2; }
                }
                while (i + 1 < textEnd && i + 1 < bytes.length) {
                    const ch = le ? (bytes[i] | (bytes[i+1] << 8)) : ((bytes[i] << 8) | bytes[i+1]);
                    if (ch === 0) break;
                    text += String.fromCharCode(ch);
                    i += 2;
                }
            }
            return text.trim() || null;
        } catch (e) { return null; }
    }

    static hasID3v2Header(bytes) {
        return bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
    }

    static parseID3v2Header(bytes) {
        const version = bytes[3];
        const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
        return { version, size, headerSize: 10 };
    }

    static findAPICFrame(bytes, headerInfo) {
        let offset = headerInfo.headerSize;
        const maxOffset = Math.min(offset + headerInfo.size, bytes.length);

        while (offset < maxOffset - 10) {
            const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
            if (bytes[offset] === 0x00) break;

            let frameSize;
            if (headerInfo.version === 4) {
               frameSize = (bytes[offset + 4] << 21) | (bytes[offset + 5] << 14) | (bytes[offset + 6] << 7) | bytes[offset + 7];
            } else {
               frameSize = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
            }

            if (frameId === 'APIC') {
                return this.parseAPICFrame(bytes, offset + 10, frameSize);
            }
            offset += 10 + frameSize;
        }
        return null;
    }

    static parseAPICFrame(bytes, offset, size) {
        try {
            let pos = offset;
            const encoding = bytes[pos++];
            let mimeType = '';
            while (pos < offset + size && bytes[pos] !== 0) mimeType += String.fromCharCode(bytes[pos++]);
            pos++; // Skip null
            pos++; // Picture type
            
            // Skip description
            if (encoding === 0 || encoding === 3) {
                while (pos < offset + size && bytes[pos] !== 0) pos++;
                pos++;
            } else {
                while (pos < offset + size - 1 && !(bytes[pos] === 0 && bytes[pos+1] === 0)) pos++;
                pos += 2;
            }

            const imgLen = offset + size - pos;
            if (imgLen <= 0) return null;
            const imgBytes = bytes.slice(pos, offset + size);
            return { base64: this.bytesToBase64(imgBytes), mimeType: mimeType || 'image/jpeg' };
        } catch (e) { return null; }
    }

    static base64ToBytes(base64) {
        // Remove whitespace and newlines
        const cleanBase64 = base64.replace(/\s/g, '');
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const lookup = new Uint8Array(256);
        for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

        let len = cleanBase64.length;
        if (cleanBase64.endsWith('==')) len -= 2;
        else if (cleanBase64.endsWith('=')) len -= 1;

        const bytes = new Uint8Array(Math.floor(cleanBase64.length * 0.75));
        let i = 0, j = 0;
        while (i < cleanBase64.length) {
            const c1 = lookup[cleanBase64.charCodeAt(i++)];
            const c2 = lookup[cleanBase64.charCodeAt(i++)];
            const c3 = lookup[cleanBase64.charCodeAt(i++)];
            const c4 = lookup[cleanBase64.charCodeAt(i++)];

            bytes[j++] = (c1 << 2) | (c2 >> 4);
            bytes[j++] = ((c2 & 15) << 4) | (c3 >> 2);
            bytes[j++] = ((c3 & 3) << 6) | c4;
        }
        return bytes.slice(0, Math.floor(len * 0.75));
    }

    static bytesToBase64(bytes) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let base64 = '';
        for (let i = 0; i < bytes.length; i += 3) {
            const b1 = bytes[i];
            const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
            const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

            base64 += chars.charAt(b1 >> 2);
            base64 += chars.charAt(((b1 & 3) << 4) | (b2 >> 4));
            
            if (i + 1 < bytes.length) {
                base64 += chars.charAt(((b2 & 15) << 2) | (b3 >> 6));
            } else {
                base64 += '=';
            }
            
            if (i + 2 < bytes.length) {
                base64 += chars.charAt(b3 & 63);
            } else {
                base64 += '=';
            }
        }
        return base64;
    }
}

export default AudioMetadataParser;
