const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const NodeCache = require('node-cache');
const fetch = require('node-fetch');

const CANAIS_URL = 'https://gist.githubusercontent.com/pedra90z/0dcf405f58abe4b327ddff457f40bc35/raw/d0f4721acb0def74da1381ada390752c65b697f8/gistfile1.txt';

const PORT = process.env.PORT || 63819;
const CACHE_TTL = 3600 * 4;

const cache = new NodeCache({ stdTTL: CACHE_TTL });

async function loadChannels() {
    const cachedChannels = cache.get('channels');
    if (cachedChannels) {
        console.log('Loading channels from cache.');
        return cachedChannels;
    }

    try {
        console.log(`Fetching channels from URL: ${CANAIS_URL}`);
        const response = await fetch(CANAIS_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }
        const channels = await response.json();
        
        cache.set('channels', channels);
        console.log(`Loaded and cached ${channels.length} channels.`);
        return channels;
    } catch (error) {
        console.error('Fatal error loading channels from URL:', error);
        return [];
    }
}

const manifest = {
    id: 'community.iptvbrasil.mastermind.online',
    version: '1.1.0',
    name: 'Mastermind IPTV',
    description: 'Se não estiver atualizado, mande listas m3u em gist para carvalhoclay@icloud.com',
    resources: ['stream', 'catalog', 'meta'],
    types: ['tv'],
    catalogs: [
        {
            type: 'tv',
            id: 'vivo-fibra-tv',
            name: 'Vivo Fibra TV',
            extra: [
                {
                    name: 'genre',
                    isRequired: false,
                    options: [
                        "FILMES E SÉRIES",
                        "ESPORTES",
                        "NOTÍCIAS",
                        "VARIEDADES",
                        "INFANTIL",
                        "DOCUMENTÁRIOS",
                        "MÚSICA"
                    ]
                }
            ]
        }
    ],
    idPrefixes: ['vf-'],
    logo: 'https://i.imgur.com/DxrcqNW_d.webp?maxwidth=520&shape=thumb&fidelity=high',
    background: 'https://t.ctcdn.com.br/8DxJzUzINYD_PWZP1pi8BXISznA=/768x432/smart/i992757.jpeg'
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log('Request for catalog:', { type, id, extra });
    if (type !== 'tv' || id !== 'vivo-fibra-tv') {
        return Promise.resolve({ metas: [] });
    }

    const channels = await loadChannels();
    let filtered = channels;

    if (extra?.genre) {
        const genres = Array.isArray(extra.genre) ? extra.genre : [extra.genre];
        filtered = channels.filter(ch =>
            ch.group && genres.some(g => ch.group.toUpperCase().includes(g.toUpperCase()))
        );
    }

    const metas = filtered.map(ch => ({
        id: ch.id,
        name: ch.name,
        type: 'tv',
        poster: ch.logo,
        genres: ch.group ? [ch.group] : [],
        posterShape: 'landscape'
    }));

    return { metas };
});

builder.defineMetaHandler(async ({ type, id }) => {
    console.log('Request for meta:', { type, id });
    if (type !== 'tv') {
        return { meta: null };
    }

    const channels = await loadChannels();
    const channel = channels.find(ch => ch.id === id);

    if (channel) {
        const meta = {
            id: channel.id,
            name: channel.name,
            type: 'tv',
            poster: channel.logo,
            background: channel.logo,
            genres: channel.group ? [channel.group] : [],
            posterShape: 'landscape',
            description: `Assista ao canal ${channel.name} ao vivo.`
        };
        return { meta };
    }
    
    return { meta: null };
});

builder.defineStreamHandler(async ({ type, id }) => {
    console.log('Request for stream:', { type, id });
    if (type !== 'tv') {
        return { streams: [] };
    }

    const channels = await loadChannels();
    const channel = channels.find(ch => ch.id === id);

    if (channel && channel.url) {
        const streams = [{
            title: 'Assistir',
            url: channel.url
        }];
        return { streams };
    }

    return { streams: [] };
});

serveHTTP(builder.getInterface(), { port: PORT });

console.log(`Addon is running at: http://127.0.0.1:${PORT}/manifest.json`);