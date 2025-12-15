package com.melody

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import okhttp3.OkHttpClient
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.services.youtube.YoutubeService
import org.schabi.newpipe.extractor.stream.StreamInfo

class StreamModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        // Initialize NewPipe
        if (NewPipeDownloaderInstance.downloader == null) {
             val client = OkHttpClient.Builder().build()
             val downloader = NewPipeDownloader(client)
             NewPipe.init(downloader)
             NewPipeDownloaderInstance.downloader = downloader
        }
    }

    override fun getName(): String {
        return "StreamModule"
    }

    @ReactMethod
    fun getStreamUrl(videoId: String, cookies: String?, promise: Promise) {
        // Run on background thread to prevent UI freeze
        Thread {
            try {
                // Set cookies if provided
                if (cookies != null && cookies.isNotEmpty()) {
                    NewPipeDownloaderInstance.downloader?.setCookies(cookies)
                }

                val service = ServiceList.YouTube
                val url = "https://www.youtube.com/watch?v=$videoId"
                
                // Get stream info (Synchronous Network Call)
                val streamInfo = StreamInfo.getInfo(service, url)
                
                // Get audio streams
                val audioStreams = streamInfo.audioStreams
                
                // Find best audio stream (highest nitrate)
                val bestStream = audioStreams.maxByOrNull { it.bitrate }
                
                if (bestStream != null) {
                    // Get the actual stream URL using getUrl() method
                    val streamUrl = bestStream.getUrl()
                    
                    // Debug logging
                    android.util.Log.d("StreamModule", "Video ID: $videoId, Stream URL: $streamUrl")
                    
                    // Validate URL before returning
                    if (streamUrl.isNullOrEmpty()) {
                        android.util.Log.e("StreamModule", "Stream URL is null or empty for $videoId")
                        promise.reject("INVALID_URL", "Stream URL is null or empty for $videoId")
                        return@Thread
                    }
                    
                    // Validate URL format
                    if (!streamUrl.startsWith("http://") && !streamUrl.startsWith("https://")) {
                        android.util.Log.e("StreamModule", "Invalid URL format: $streamUrl")
                        promise.reject("INVALID_URL", "Invalid URL format (not HTTP/HTTPS): $streamUrl")
                        return@Thread
                    }
                    
                    // Return URL and metadata
                    val result = com.facebook.react.bridge.Arguments.createMap()
                    result.putString("url", streamUrl)
                    result.putString("title", streamInfo.name)
                    result.putString("author", streamInfo.uploaderName)
                    result.putDouble("duration", streamInfo.duration.toDouble())
                    
                    // Safely get thumbnail URL
                    val thumbnailUrl = if (streamInfo.thumbnails.isNotEmpty()) {
                        streamInfo.thumbnails.get(0).url
                    } else {
                        ""
                    }
                    result.putString("thumbnail", thumbnailUrl)
                    
                    android.util.Log.d("StreamModule", "Successfully fetched stream for $videoId")
                    promise.resolve(result)
                } else {
                    android.util.Log.e("StreamModule", "No audio stream found for $videoId")
                    promise.reject("NO_STREAM", "No audio stream found for $videoId")
                }
            } catch (e: Exception) {
                promise.reject("STREAM_ERROR", e.message, e)
            }
        }.start()
    }
}

object NewPipeDownloaderInstance {
    var downloader: NewPipeDownloader? = null
}
