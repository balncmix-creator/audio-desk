import org.gradle.process.ExecOperations
import javax.inject.Inject

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
        versionCode = 27
        versionName = "1.26"
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
    testOptions { unitTests.isIncludeAndroidResources = true }
    // Each edition has exactly one index.html; generated asset priority must
    // never determine whether the restricted discovery feature is packaged.
    sourceSets.getByName("main").assets.setSrcDirs(emptyList<String>())
    sourceSets.getByName("debug").assets.srcDir("src/main/assets")
}

abstract class PreparePlayAssets : DefaultTask() {
    @get:InputFile abstract val sourceHtml: RegularFileProperty
    @get:InputFile abstract val generatorScript: RegularFileProperty
    @get:InputFile abstract val premiumImage: RegularFileProperty
    @get:OutputDirectory abstract val outputDirectory: DirectoryProperty
    @get:Inject abstract val execOperations: ExecOperations

    @TaskAction
    fun generate() {
        execOperations.exec {
            commandLine("node", generatorScript.get().asFile.absolutePath, outputDirectory.get().asFile.absolutePath)
        }
    }
}

androidComponents {
    onVariants(selector().withBuildType("release")) { variant ->
        val prepare = tasks.register<PreparePlayAssets>("preparePlayAssets") {
            sourceHtml.set(layout.projectDirectory.file("src/main/assets/index.html"))
            generatorScript.set(rootProject.layout.projectDirectory.file("scripts/prepare-play.cjs"))
            premiumImage.set(layout.projectDirectory.file("src/main/assets/desk-premium.webp"))
            outputDirectory.set(layout.buildDirectory.dir("generated/playAssets"))
        }
        // Let AGP track the producer for every asset consumer, including lint.
        variant.sources.assets?.addGeneratedSourceDirectory(prepare, PreparePlayAssets::outputDirectory)
    }
}
dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.14.1")
}
