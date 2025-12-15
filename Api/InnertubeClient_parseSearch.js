    static parseSearch(data, filter) {
    const results = [];
    try {
        const contents = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
        if (!contents) {
            console.log('InnerTube Search: No contents found');
            return [];
        }

        console.log(`InnerTube Search: Found ${contents.length} sections`);

        // YouTube wraps results in itemSectionRenderer - need to look inside
        let musicShelfRenderer = null;

        for (const section of contents) {
            const keys = Object.keys(section);
            console.log(`  Section: [${keys.join(', ')}]`);

            // Direct musicShelfRenderer
            if (section.musicShelfRenderer) {
                musicShelfRenderer = section.musicShelfRenderer;
                console.log('  -> Found musicShelfRenderer directly');
                break;
            }

            // Check inside itemSectionRenderer wrapper
            if (section.itemSectionRenderer?.contents) {
                console.log('  -> Checking inside itemSectionRenderer...');
                for (const item of section.itemSectionRenderer.contents) {
                    if (item.musicShelfRenderer) {
                        musicShelfRenderer = item.musicShelfRenderer;
                        console.log('  -> Found musicShelfRenderer inside itemSectionRenderer!');
                        break;
                    }
                }
            }
            if (musicShelfRenderer) break;
        }

        if (!musicShelfRenderer) {
            console.log('InnerTube Search: No musicShelfRenderer found');
            return [];
        }

        console.log(`InnerTube Search: musicShelfRenderer has ${musicShelfRenderer.contents?.length || 0} items`);

        if (musicShelfRenderer?.contents) {
            musicShelfRenderer.contents.forEach((item, idx) => {
                const parsed = this.parseItem(item);
                if (parsed) {
                    console.log(`✓ ${idx}: ${parsed.title} (${parsed.videoId})`);
                    results.push(parsed);
                }
            });
        }

        console.log(`InnerTube Search: Returning ${results.length} results`);
    } catch (e) { console.error('Parse Search Error', e); }
    return results;
}
