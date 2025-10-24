//
//  Extentions.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 10/17/25.
//

import Foundation

extension TimeInterval {
    /// Formats a TimeInterval (in seconds) as MM:SS
    func formatTime() -> String {
        let m = Int(self) / 60
        let s = Int(self) % 60
        let mm = String(format: "%02d", m)
        let ss = String(format: "%02d", s)
        return "\(mm):\(ss)"
    }
}
