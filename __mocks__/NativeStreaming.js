export default {
  getStreamUrl: jest.fn(async (videoId) => ({
    url: `https://example.com/${videoId}.mp3`,
    thumbnail: '',
    duration: 0,
    title: 'mock',
    author: 'mock',
  })),
};
