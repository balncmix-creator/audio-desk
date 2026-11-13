plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.balnc.audioddesk"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.balnc.audioddesk"
        minSdk = 23
        targetSdk = 36
        versionCode = 13
        versionName = "1.12"
    }
    signingConfigs {
        create("stableDebug") {
            storeFile = file("audio-desk-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
        val releaseStore = System.getenv("AUDIO_DESK_RELEASE_STORE_FILE")
        if (!releaseStore.isNullOrBlank()) {
            create("privateRelease") {
                storeFile = file(releaseStore)
                storePassword = requireNotNull(System.getenv("AUDIO_DESK_RELEASE_STORE_PASSWORD"))
                keyAlias = requireNotNull(System.getenv("AUDIO_DESK_RELEASE_KEY_ALIAS"))
                keyPassword = requireNotNull(System.getenv("AUDIO_DESK_RELEASE_KEY_PASSWORD"))
            }
        }
    }
    buildTypes {
        debug { signingConfig = signingConfigs.getByName("stableDebug") }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("privateRelease")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets.getByName("release").assets.srcDir(layout.buildDirectory.dir("generated/playAssets"))
}

val preparePlayAssets by tasks.registering(Exec::class) {
    inputs.files("src/main/assets/index.html", "../scripts/prepare-play.cjs")
    outputs.dir(layout.buildDirectory.dir("generated/playAssets"))
    workingDir = rootProject.projectDir
    commandLine("node", "scripts/prepare-play.cjs")
}
tasks.configureEach {
    if (name == "mergeReleaseAssets") dependsOn(preparePlayAssets)
}
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
