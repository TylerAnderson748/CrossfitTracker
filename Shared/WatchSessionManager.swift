//
//  WatchSessionManager.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation
import WatchConnectivity

class WatchSessionManager: NSObject, WCSessionDelegate, ObservableObject {
    static let shared = WatchSessionManager()
    private override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: Send data to iPhone
    func sendWODStart(_ wodID: String) {
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(["startWOD": wodID], replyHandler: nil)
        }
    }

    func sendWODStop(_ wodID: String, elapsed: TimeInterval, category: String) {
        if WCSession.default.isReachable {
            WCSession.default.sendMessage([
                "stopWOD": wodID,
                "time": elapsed,
                "category": category
            ], replyHandler: nil)
        }
    }

    // MARK: Receive data from iPhone
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
            if let startID = message["startWOD"] as? String {
                NotificationCenter.default.post(name: .watchStartWOD, object: startID)
            }
            if let stopID = message["stopWOD"] as? String,
               let time = message["time"] as? TimeInterval,
               let categoryStr = message["category"] as? String,
               let category = WODCategory(rawValue: categoryStr),
               let wod = SampleData.wods.first(where: { $0.id.uuidString == stopID }) {
                let completedWOD = CompletedWOD(wod: wod, userName: "OtherUser", time: time, category: category)
                NotificationCenter.default.post(name: .watchStopWOD, object: completedWOD)
            }
        }
    }

    // MARK: Required WCSessionDelegate stubs

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
}


