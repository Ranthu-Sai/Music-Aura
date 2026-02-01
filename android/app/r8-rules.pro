# R8 specific rules to suppress warnings
# This file addresses R8-specific warnings that don't affect app functionality

# Suppress Fresco CloseableAnimatedImage warning
# This is a known issue where R8 incorrectly warns about interfaces
-assumevalues class com.facebook.imagepipeline.image.CloseableAnimatedImage {
    *;
}
