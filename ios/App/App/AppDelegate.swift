import UIKit
import Capacitor
import FirebaseCore

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        FirebaseApp.configure()
        let googleServiceInfoExists = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil
        print("[NativeAuthDebug] GoogleService-Info.plist exists: \(googleServiceInfoExists)")
        print("[NativeAuthDebug] FirebaseApp.configure completed")
        return true
    }

    func application(
        _ app: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        print("[NativeAuthDebug] open url callback: \(url.absoluteString)")
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }
}
