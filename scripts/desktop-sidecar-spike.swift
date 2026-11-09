// Unsigned headless experiment. It only supervises the existing Node launcher.
import Darwin
import Dispatch
import Foundation

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.count == 2 else { exit(2) }
let launcher = Process()
launcher.executableURL = URL(fileURLWithPath: arguments[0])
launcher.currentDirectoryURL = URL(fileURLWithPath: arguments[1])
launcher.arguments = ["scripts/launch.mjs", "--no-browser"]
launcher.standardOutput = FileHandle.standardOutput
launcher.standardError = FileHandle.standardError

signal(SIGTERM, SIG_IGN)
signal(SIGINT, SIG_IGN)
let observers = [SIGTERM, SIGINT].map { value in
    let observer = DispatchSource.makeSignalSource(signal: value, queue: .global())
    observer.setEventHandler { if launcher.isRunning { launcher.terminate() } }
    observer.resume()
    return observer
}
do {
    try launcher.run()
} catch {
    FileHandle.standardError.write(Data("Sidecar start failed.\n".utf8))
    exit(2)
}
launcher.waitUntilExit()
withExtendedLifetime(observers) {}
exit(launcher.terminationStatus)
