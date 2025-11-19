//
//  LiftPercentageView.swift
//  CrossfitTracker
//
//  Created by Tyler Anderson on 11/19/25.
//

import SwiftUI

struct LiftPercentageView: View {
    @Environment(\.dismiss) var dismiss
    let result: LiftResult

    var body: some View {
        NavigationView {
            List {
                Section(header: Text("Your Lift")) {
                    HStack {
                        Text(result.liftTitle)
                            .font(.headline)
                        Spacer()
                        Text("\(Int(result.weight)) lbs × \(result.reps) rep\(result.reps == 1 ? "" : "s")")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Estimated 1RM")
                            .font(.headline)
                        Spacer()
                        Text(String(format: "%.1f lbs", result.estimatedOneRepMax))
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.blue)
                    }
                }

                Section(header: Text("Training Percentages")) {
                    ForEach(result.percentageWeights(of: result.estimatedOneRepMax), id: \.percentage) { item in
                        HStack {
                            Text("\(item.percentage)%")
                                .font(.headline)
                                .foregroundColor(colorForPercentage(item.percentage))
                                .frame(width: 60, alignment: .leading)

                            Spacer()

                            Text(String(format: "%.1f lbs", item.weight))
                                .font(.body)
                                .fontWeight(.medium)
                        }
                        .padding(.vertical, 4)
                    }
                }

                Section(footer: percentageGuide) {
                    EmptyView()
                }
            }
            .navigationTitle("Percentage Chart")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func colorForPercentage(_ percentage: Int) -> Color {
        switch percentage {
        case 50...65:
            return .green
        case 70...80:
            return .orange
        case 85...95:
            return .red
        case 100...:
            return .purple
        default:
            return .primary
        }
    }

    private var percentageGuide: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Training Guide:")
                .font(.headline)
                .padding(.bottom, 4)

            GuideRow(color: .green, range: "50-65%", description: "Technique & Speed work")
            GuideRow(color: .orange, range: "70-80%", description: "Strength building")
            GuideRow(color: .red, range: "85-95%", description: "Heavy strength")
            GuideRow(color: .purple, range: "100%", description: "Max effort")
        }
        .padding(.top, 8)
    }
}

struct GuideRow: View {
    let color: Color
    let range: String
    let description: String

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(color)
                .frame(width: 12, height: 12)

            Text(range)
                .font(.subheadline)
                .fontWeight(.medium)
                .frame(width: 60, alignment: .leading)

            Text(description)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}
