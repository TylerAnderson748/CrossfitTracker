import Foundation

// MARK: - Recurrence Pattern
enum RecurrenceType: String, Codable, CaseIterable {
    case none = "None"
    case once = "Once"
    case daily = "Daily"
    case weekly = "Weekly"
    case monthly = "Monthly"
}

// MARK: - Weekly Recurrence
struct WeeklyRecurrence: Codable, Equatable {
    var selectedDays: Set<Weekday>

    enum Weekday: Int, Codable, CaseIterable, Identifiable {
        case sunday = 1
        case monday = 2
        case tuesday = 3
        case wednesday = 4
        case thursday = 5
        case friday = 6
        case saturday = 7

        var id: Int { rawValue }

        var shortName: String {
            switch self {
            case .sunday: return "Sun"
            case .monday: return "Mon"
            case .tuesday: return "Tue"
            case .wednesday: return "Wed"
            case .thursday: return "Thu"
            case .friday: return "Fri"
            case .saturday: return "Sat"
            }
        }

        var fullName: String {
            switch self {
            case .sunday: return "Sunday"
            case .monday: return "Monday"
            case .tuesday: return "Tuesday"
            case .wednesday: return "Wednesday"
            case .thursday: return "Thursday"
            case .friday: return "Friday"
            case .saturday: return "Saturday"
            }
        }
    }
}

// MARK: - Monthly Recurrence
struct MonthlyRecurrence: Codable, Equatable {
    var option: MonthlyOption
    var dayOfMonth: Int? // For specific day option (1-31)
    var weekOfMonth: Int? // For weekday option (1-5, where 5 = last)
    var dayOfWeek: WeeklyRecurrence.Weekday? // For weekday option

    enum MonthlyOption: String, Codable, CaseIterable {
        case specificDay = "Specific Day"
        case firstWeekday = "First Weekday"
        case secondWeekday = "Second Weekday"
        case thirdWeekday = "Third Weekday"
        case fourthWeekday = "Fourth Weekday"
        case lastWeekday = "Last Weekday"
        case lastDayOfMonth = "Last Day of Month"
    }

    // Helper to create specific day recurrence
    static func onDay(_ day: Int) -> MonthlyRecurrence {
        MonthlyRecurrence(option: .specificDay, dayOfMonth: day, weekOfMonth: nil, dayOfWeek: nil)
    }

    // Helper to create weekday recurrence
    static func onWeekday(week: Int, day: WeeklyRecurrence.Weekday) -> MonthlyRecurrence {
        let option: MonthlyOption
        switch week {
        case 1: option = .firstWeekday
        case 2: option = .secondWeekday
        case 3: option = .thirdWeekday
        case 4: option = .fourthWeekday
        case 5: option = .lastWeekday
        default: option = .firstWeekday
        }
        return MonthlyRecurrence(option: option, dayOfMonth: nil, weekOfMonth: week, dayOfWeek: day)
    }
}

// MARK: - Scheduled Workout
struct ScheduledWorkout: Identifiable, Codable {
    var id: String?
    var wodId: String
    var wodTitle: String
    var wodDescription: String
    var date: Date
    var groupId: String? // nil for personal workouts
    var timeSlots: [String]
    var createdBy: String
    var recurrenceType: RecurrenceType
    var recurrenceEndDate: Date?
    var weekdays: [Int]? // For weekly recurrence (1=Sunday, 7=Saturday)

    // Legacy support for old model structure
    var workoutType: WorkoutType?
    var liftID: UUID? // If workoutType is .lift
    var wodID: UUID? // If workoutType is .wod
    var weeklyRecurrence: WeeklyRecurrence?
    var monthlyRecurrence: MonthlyRecurrence?
    var startDate: Date?
    var endDate: Date? // Optional end date for the schedule
    var isActive: Bool = true

    // Computed properties
    var isRecurring: Bool {
        return recurrenceType != .none && recurrenceType != .once
    }

    var isPersonalWorkout: Bool {
        return groupId == nil
    }

    // Helper computed properties
    var workoutName: String {
        return wodTitle
    }

    // Check if this workout should occur on a given date
    func shouldOccur(on date: Date) -> Bool {
        guard isActive else { return false }

        let checkDate = startDate ?? self.date
        let checkEndDate = endDate ?? recurrenceEndDate

        // Check if date is within the active range
        if date < checkDate { return false }
        if let end = checkEndDate, date > end { return false }

        switch recurrenceType {
        case .none:
            return false

        case .once:
            return Calendar.current.isDate(date, inSameDayAs: self.date)

        case .daily:
            return true // Occurs every day within the date range

        case .weekly:
            if let weekdays = weekdays, !weekdays.isEmpty {
                let weekday = Calendar.current.component(.weekday, from: date)
                return weekdays.contains(weekday)
            } else if let weekly = weeklyRecurrence {
                let weekday = Calendar.current.component(.weekday, from: date)
                return weekly.selectedDays.contains(where: { $0.rawValue == weekday })
            }
            return false

        case .monthly:
            guard let monthly = monthlyRecurrence else { return false }
            return monthly.matches(date: date)
        }
    }

    init(
        id: String? = nil,
        wodId: String,
        wodTitle: String,
        wodDescription: String,
        date: Date,
        groupId: String? = nil,
        timeSlots: [String] = [],
        createdBy: String,
        recurrenceType: RecurrenceType = .once,
        recurrenceEndDate: Date? = nil,
        weekdays: [Int]? = nil
    ) {
        self.id = id
        self.wodId = wodId
        self.wodTitle = wodTitle
        self.wodDescription = wodDescription
        self.date = date
        self.groupId = groupId
        self.timeSlots = timeSlots
        self.createdBy = createdBy
        self.recurrenceType = recurrenceType
        self.recurrenceEndDate = recurrenceEndDate
        self.weekdays = weekdays
    }
}

// MARK: - MonthlyRecurrence Date Matching
extension MonthlyRecurrence {
    func matches(date: Date) -> Bool {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day, .weekday, .weekOfMonth], from: date)

        guard let day = components.day,
              let weekday = components.weekday,
              let weekOfMonth = components.weekOfMonth else {
            return false
        }

        switch option {
        case .specificDay:
            guard let targetDay = dayOfMonth else { return false }
            return day == targetDay

        case .lastDayOfMonth:
            let range = calendar.range(of: .day, in: .month, for: date)
            return day == range?.count

        case .firstWeekday, .secondWeekday, .thirdWeekday, .fourthWeekday, .lastWeekday:
            guard let targetWeek = self.weekOfMonth,
                  let targetDay = self.dayOfWeek else {
                return false
            }

            // weekOfMonth from date components is already unwrapped

            // Check if it's the last occurrence of this weekday in the month
            if option == .lastWeekday {
                // Check if this is the last occurrence
                if let nextWeek = calendar.date(byAdding: .weekOfMonth, value: 1, to: date) {
                    let nextMonth = calendar.component(.month, from: nextWeek)
                    let currentMonth = calendar.component(.month, from: date)
                    // If adding a week changes the month, this is the last occurrence
                    return weekday == targetDay.rawValue && nextMonth != currentMonth
                }
                return false
            } else {
                return weekOfMonth == targetWeek && weekday == targetDay.rawValue
            }
        }
    }
}
