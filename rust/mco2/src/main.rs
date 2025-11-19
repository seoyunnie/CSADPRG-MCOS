/*
 * Last Names: Panaligan (Author), Casihan, Cotoco, Mascardo
 * Language: Rust
 * Paradigm(s): Procedural, Object-Oriented, Functional
 */

mod project {
    use chrono::NaiveDate;
    use serde::Deserialize;
    use std::{error, sync::OnceLock};
    use thousands::Separable;

    #[allow(dead_code)]
    #[derive(Debug, Deserialize, Clone)]
    #[serde(rename_all(deserialize = "PascalCase"))]
    pub struct Project {
        pub main_island: String,
        pub region: String,
        pub province: String,
        pub legislative_district: String,
        pub municipality: String,
        pub district_engineering_office: String,
        pub project_id: String,
        pub project_name: String,
        pub type_of_work: String,
        pub funding_year: u32,
        pub contract_id: String,
        pub approved_budget_for_contract: f64,
        pub contract_cost: f64,
        pub actual_completion_date: NaiveDate,
        pub contractor: String,
        pub start_date: NaiveDate,
        pub project_latitude: f64,
        pub project_longitude: f64,
        pub provincial_capital: String,
        pub provincial_capital_latitude: f64,
        pub provincial_capital_longitude: f64,

        #[serde(skip_deserializing)]
        cached_cost_savings: OnceLock<f64>,
        #[serde(skip_deserializing)]
        cached_completion_delay_days: OnceLock<i64>,
    }
    impl Project {
        pub fn cost_savings(&self) -> f64 {
            *self
                .cached_cost_savings
                .get_or_init(|| self.approved_budget_for_contract - self.contract_cost)
        }

        pub fn completion_delay_days(&self) -> i64 {
            *self
                .cached_completion_delay_days
                .get_or_init(|| (self.actual_completion_date - self.start_date).num_days())
        }
    }

    pub fn parse_csv_records() -> Result<Vec<Project>, Box<dyn error::Error>> {
        let mut fr = csv::Reader::from_path("dpwh_flood_control_projects.csv")?;

        print!("Processing dataset...");

        let projects = fr.deserialize::<Project>().flatten().collect::<Vec<Project>>();
        let project_cnt = projects.len();

        let filtered_projects = projects
            .into_iter()
            .filter(|p| (2021..=2023).contains(&p.funding_year))
            .collect::<Vec<Project>>();

        println!(
            "  ({} rows loaded, {} filtered for 2021-2023)",
            project_cnt.separate_with_commas(),
            filtered_projects.len().separate_with_commas()
        );

        Ok(filtered_projects)
    }
}

mod formatted_serializer {
    use serde::Serializer;
    use thousands::Separable;

    pub fn serialize_f64<S>(val: &f64, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let truncated_val = (*val * 100.0).round() / 100.0;

        serializer.serialize_str(truncated_val.separate_with_commas().as_str())
    }

    pub fn serialize_usize<S>(val: &usize, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(val.separate_with_commas().as_str())
    }
}

mod report {
    use crate::formatted_serializer::{serialize_f64, serialize_usize};
    use crate::project::Project;
    use itertools::Itertools;
    use serde::Serialize;
    use std::{
        collections::{HashMap, HashSet},
        error,
        fs::File,
        io::Write,
    };

    #[derive(Debug, Serialize)]
    #[serde(rename_all(serialize = "PascalCase"))]
    struct RegionEfficiency {
        region: String,
        main_island: String,
        #[serde(serialize_with = "serialize_f64")]
        total_budget: f64,
        #[serde(serialize_with = "serialize_f64")]
        median_savings: f64,
        #[serde(serialize_with = "serialize_f64")]
        avg_delay: f64,
        #[serde(serialize_with = "serialize_f64")]
        high_delay_pct: f64,
        #[serde(serialize_with = "serialize_f64")]
        efficiency_score: f64,
    }

    pub fn create_report_1(projects: &[Project]) -> Result<(), Box<dyn error::Error>> {
        let mut region_efficiencies = Vec::<RegionEfficiency>::new();

        for (region, projects) in projects.iter().into_group_map_by(|&p| &p.region) {
            let mut cost_savings = projects.iter().map(|&p| p.cost_savings()).collect::<Vec<f64>>();
            cost_savings.sort_by(|a, b| a.total_cmp(b));
            let median_savings = cost_savings[cost_savings.len() / 2];

            let completion_delay_days = projects
                .iter()
                .map(|&p| p.completion_delay_days())
                .collect::<Vec<i64>>();
            let avg_delay =
                completion_delay_days.iter().copied().sum::<i64>() as f64 / completion_delay_days.len() as f64;

            region_efficiencies.push(RegionEfficiency {
                region: region.clone(),
                main_island: projects[0].main_island.clone(),
                total_budget: projects.iter().map(|&p| p.approved_budget_for_contract).sum::<f64>(),
                median_savings,
                avg_delay,
                high_delay_pct: (completion_delay_days.iter().copied().filter(|&d| d > 30).count() as f64
                    / completion_delay_days.len() as f64)
                    * 100.0,
                efficiency_score: (median_savings / avg_delay) * 100.0,
            });
        }

        region_efficiencies.sort_by(|a, b| b.efficiency_score.total_cmp(&a.efficiency_score));

        let file_name = "report1_regional_summary.csv";
        let mut fw = csv::Writer::from_path(file_name)?;

        for region_efficiency in region_efficiencies {
            fw.serialize(region_efficiency)?;
        }

        fw.flush()?;

        println!("1. Flood Mitigation Efficiency Summary (exported to {file_name})");

        Ok(())
    }

    #[derive(Debug, Serialize)]
    #[serde(rename_all(serialize = "PascalCase"))]
    struct ContractorPerformance {
        rank: usize,
        contractor: String,
        #[serde(serialize_with = "serialize_f64")]
        total_cost: f64,
        #[serde(serialize_with = "serialize_usize")]
        num_projects: usize,
        #[serde(serialize_with = "serialize_f64")]
        avg_delay: f64,
        #[serde(serialize_with = "serialize_f64")]
        total_savings: f64,
        #[serde(serialize_with = "serialize_f64")]
        reliability_index: f64,
        risk_flag: String,
    }

    pub fn create_report_2(projects: &[Project]) -> Result<(), Box<dyn error::Error>> {
        let mut contractor_performances = Vec::<ContractorPerformance>::new();

        for (contractor, projects) in projects.iter().into_group_map_by(|&p| &p.contractor) {
            if projects.len() < 5 {
                continue;
            }

            let total_cost = projects.iter().map(|&p| p.contract_cost).sum::<f64>();

            let completion_delay_days = projects
                .iter()
                .map(|&p| p.completion_delay_days())
                .collect::<Vec<i64>>();
            let avg_delay =
                completion_delay_days.iter().copied().sum::<i64>() as f64 / completion_delay_days.len() as f64;

            let total_savings = projects.iter().map(|&p| p.cost_savings()).sum::<f64>();

            let reliability_idx = ((1.0 - (avg_delay / 90.0)) * (total_savings / total_cost) * 100.0)
                .clamp(0.0, 100.0)
                .abs();

            contractor_performances.push(ContractorPerformance {
                rank: 0,
                contractor: contractor.clone(),
                total_cost,
                num_projects: projects.len(),
                avg_delay,
                total_savings,
                reliability_index: reliability_idx,
                risk_flag: if reliability_idx < 50.0 {
                    String::from("High Risk")
                } else {
                    String::from("Low Risk")
                },
            });
        }

        contractor_performances.sort_by(|a, b| a.total_cost.total_cmp(&b.total_cost));
        contractor_performances = contractor_performances.into_iter().take(15).rev().collect();

        for (i, contractor_perf) in contractor_performances.iter_mut().enumerate() {
            contractor_perf.rank = i + 1;
        }

        let file_name = "report2_contractor_ranking.csv";
        let mut fw = csv::Writer::from_path(file_name)?;

        for contractor_perf in contractor_performances.into_iter() {
            fw.serialize(contractor_perf)?;
        }

        fw.flush()?;

        println!("2. Top Contractors Performance Ranking (exported to {file_name})");

        Ok(())
    }

    #[derive(Debug, Serialize)]
    #[serde(rename_all(serialize = "PascalCase"))]
    struct ProjectOverrunTrend {
        funding_year: u32,
        type_of_work: String,
        #[serde(serialize_with = "serialize_usize")]
        total_projects: usize,
        #[serde(serialize_with = "serialize_f64")]
        avg_savings: f64,
        #[serde(serialize_with = "serialize_f64")]
        overrun_rate: f64,
        #[serde(rename(serialize = "YoYChange"))]
        #[serde(serialize_with = "serialize_f64")]
        year_over_year_change: f64,
    }

    pub fn create_report_3(projects: &[Project]) -> Result<(), Box<dyn error::Error>> {
        let mut project_overrun_trends = Vec::<ProjectOverrunTrend>::new();

        for (year, projects) in projects.iter().into_group_map_by(|&p| p.funding_year) {
            for (type_of_work, projects) in projects.into_iter().into_group_map_by(|&p| &p.type_of_work) {
                let savings = projects.iter().map(|p| p.cost_savings()).collect::<Vec<f64>>();

                project_overrun_trends.push(ProjectOverrunTrend {
                    funding_year: year,
                    type_of_work: type_of_work.clone(),
                    total_projects: projects.len(),
                    avg_savings: savings.iter().copied().sum::<f64>() / savings.len() as f64,
                    overrun_rate: (savings.iter().copied().filter(|&s| s < 0.0).count() as f64 / savings.len() as f64)
                        * 100.0,
                    year_over_year_change: 0.0,
                });
            }
        }

        project_overrun_trends.sort_by(|a, b| {
            a.funding_year
                .cmp(&b.funding_year)
                .then_with(|| b.avg_savings.total_cmp(&a.avg_savings))
        });

        let trend_avg_savings = project_overrun_trends
            .iter()
            .map(|t| (t.funding_year, t.avg_savings))
            .collect::<HashMap<u32, f64>>();

        for trend in project_overrun_trends.iter_mut() {
            if trend.funding_year <= 2021
                && let Some(prev_avg_savings) = trend_avg_savings.iter().find(|&s| *s.0 == trend.funding_year - 1)
            {
                trend.year_over_year_change = ((trend.avg_savings - prev_avg_savings.1) / prev_avg_savings.1) * 100.0;
            }
        }

        let file_name = "report3_annual_trends.csv";
        let mut fw = csv::Writer::from_path(file_name)?;

        for trend in project_overrun_trends {
            fw.serialize(trend)?;
        }

        fw.flush()?;

        println!("3. Annual Project Type Cost Overrun Trends (exported to {file_name})");

        Ok(())
    }

    #[derive(Debug, Serialize)]
    #[serde(rename_all(serialize = "PascalCase"))]
    struct Summary {
        total_projects: usize,
        total_contractors: usize,
        global_avg_delay: f64,
        total_savings: f64,
    }

    pub fn create_summary(projects: &[Project]) -> Result<(), Box<dyn error::Error>> {
        let completion_delay_days = projects.iter().map(|p| p.completion_delay_days()).collect::<Vec<i64>>();
        let avg_delay = completion_delay_days.iter().copied().sum::<i64>() as f64 / completion_delay_days.len() as f64;

        let summary = Summary {
            total_projects: projects.len(),
            total_contractors: projects
                .iter()
                .map(|p| &p.contractor)
                .collect::<HashSet<&String>>()
                .len(),
            global_avg_delay: avg_delay,
            total_savings: projects.iter().map(|p| p.cost_savings()).sum::<f64>(),
        };

        let mut file = File::create("summary.json")?;
        let stringified_data = serde_json::to_string_pretty(&summary)?;

        file.write_all(stringified_data.as_bytes())?;

        Ok(())
    }
}

use report::{create_report_1, create_report_2, create_report_3};
use std::error;

fn main() -> Result<(), Box<dyn error::Error>> {
    let projects = project::parse_csv_records()?;

    if projects.is_empty() {
        return Ok(());
    }

    println!();

    println!("Generating reports...");

    create_report_1(&projects)?;
    create_report_2(&projects)?;
    create_report_3(&projects)?;

    println!();

    print!("Generating summary...");

    report::create_summary(&projects)?;

    println!("  (exported to summary.json)");

    Ok(())
}
