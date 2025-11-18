import { parse } from "csv";
import { stringify } from "csv/sync";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import process from "node:process";

/** @import { stringifier } from "csv/sync" */

/**
 * @param {string} str
 * @returns {number}
 */
function stringToNumber(str) {
  const num = Number(str);

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    throw new TypeError(`'${str}' is not a finite number`);
  }

  return num;
}

class Project {
  /** @type {string} */
  mainIsland;
  /** @type {string} */
  region;
  /** @type {string} */
  province;
  /** @type {string} */
  legislativeDistrict;
  /** @type {string} */
  municipality;
  /** @type {string} */
  districtEngineeringOffice;
  /** @type {string} */
  projectId;
  /** @type {string} */
  projectName;
  /** @type {string} */
  typeOfWork;
  /** @type {number} */
  fundingYear;
  /** @type {string} */
  contractId;
  /** @type {number} */
  approvedBudgetForContract;
  /** @type {number} */
  contractCost;
  /** @type {Date} */
  actualCompletionDate;
  /** @type {string} */
  contractor;
  /** @type {Date} */
  startDate;
  /** @type {number} */
  projectLatitude;
  /** @type {number} */
  projectLongitude;
  /** @type {string} */
  provincialCapital;
  /** @type {number} */
  provincialCapitalLatitude;
  /** @type {number} */
  provincialCapitalLongitude;

  /** @type {number} */
  costSavings;
  /** @type {number} */
  completionDayDelays;

  /**
   *
   * @param {Record<string, string>} rec
   */
  constructor({
    MainIsland,
    Region,
    Province,
    LegislativeDistrict,
    Municipality,
    DistrictEngineeringOffice,
    ProjectId,
    ProjectName,
    TypeOfWork,
    FundingYear,
    ContractId,
    ApprovedBudgetForContract,
    ContractCost,
    ActualCompletionDate,
    Contractor,
    StartDate,
    ProjectLatitude,
    ProjectLongitude,
    ProvincialCapital,
    ProvincialCapitalLatitude,
    ProvincialCapitalLongitude,
  }) {
    this.mainIsland = MainIsland;
    this.region = Region;
    this.province = Province;
    this.legislativeDistrict = LegislativeDistrict;
    this.municipality = Municipality;
    this.districtEngineeringOffice = DistrictEngineeringOffice;
    this.projectId = ProjectId;
    this.projectName = ProjectName;
    this.typeOfWork = TypeOfWork;
    this.fundingYear = stringToNumber(FundingYear);
    this.contractId = ContractId;
    this.approvedBudgetForContract = stringToNumber(ApprovedBudgetForContract);
    this.contractCost = stringToNumber(ContractCost);
    this.actualCompletionDate = new Date(ActualCompletionDate);
    this.contractor = Contractor;
    this.startDate = new Date(StartDate);
    this.projectLatitude = stringToNumber(ProjectLatitude);
    this.projectLongitude = stringToNumber(ProjectLongitude);
    this.provincialCapital = ProvincialCapital;
    this.provincialCapitalLatitude = stringToNumber(ProvincialCapitalLatitude);
    this.provincialCapitalLongitude = stringToNumber(ProvincialCapitalLongitude);

    this.costSavings = this.approvedBudgetForContract - this.contractCost;
    this.completionDayDelays = Math.round(
      (this.actualCompletionDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }
}

async function parse_project_csv_records() {
  const parser = createReadStream(`${import.meta.dirname}/dpwh_flood_control_projects.csv`).pipe(
    parse({ columns: true }),
  );

  process.stdout.write("Processing dataset...");

  const projects = [];

  for await (const rec of parser) {
    try {
      projects.push(new Project(rec));
    } catch {
      continue;
    }
  }

  const filteredProjects = projects.filter((p) => p.fundingYear >= 2021 && p.fundingYear <= 2023);

  console.log(
    `  (${projects.length.toLocaleString()} rows loaded, ${filteredProjects.length.toLocaleString()} filtered for 2021-2023)`,
  );

  return filteredProjects;
}

const SUM = /** @type {const} */ ([
  /**
   * @param {number} acc
   * @param {number} currVal
   * @returns {number}
   */
  (acc, currVal) => acc + currVal,
  0,
]);

const CSV_STRINGIFY_OPTIONS = /** @satisfies {stringifier.Options} */ ({
  cast: { number: (val) => val.toLocaleString("en-US", { maximumFractionDigits: 2 }) },
  header: true,
});

/**
 * @typedef RegionEfficiency
 * @property {string} Region
 * @property {string} MainIsland
 * @property {number} TotalBudget
 * @property {number} MedianSavings
 * @property {number} AvgDelay
 * @property {number} HighDelayPct
 * @property {number} EfficiencyScore
 */

/** @param {Project[]} projects */
async function createReport1(projects) {
  /** @type {RegionEfficiency[]} */
  const regionEfficiencies = [];

  for (const [region, filteredProjects] of Object.entries(Object.groupBy(projects, ({ region }) => region))) {
    if (!filteredProjects) {
      continue;
    }

    const costSavings = filteredProjects.map((p) => p.costSavings).sort((a, b) => a - b);
    const medianSavings = costSavings[Math.floor(costSavings.length / 2)];

    const completionDayDelays = filteredProjects.map((p) => p.completionDayDelays);
    const avgDelay = completionDayDelays.reduce(...SUM) / completionDayDelays.length;

    regionEfficiencies.push({
      Region: region,
      MainIsland: filteredProjects[0].mainIsland,
      TotalBudget: filteredProjects.map((p) => p.approvedBudgetForContract).reduce(...SUM),
      MedianSavings: medianSavings,
      AvgDelay: avgDelay,
      HighDelayPct: (completionDayDelays.filter((d) => d > 30).length / completionDayDelays.length) * 100,
      EfficiencyScore: (medianSavings / avgDelay) * 100,
    });
  }

  regionEfficiencies.sort((a, b) => b.EfficiencyScore - a.EfficiencyScore);

  const fileName = "report1_regional_summary.csv";

  await writeFile(fileName, stringify(regionEfficiencies, CSV_STRINGIFY_OPTIONS));

  console.log(`1. Flood Mitigation Efficiency Summary (exported to ${fileName})`);
}

/**
 * @typedef ContractorPerformance
 * @property {number} Rank
 * @property {string} Contractor
 * @property {number} TotalCost
 * @property {number} NumProjects
 * @property {number} AvgDelay
 * @property {number} TotalSavings
 * @property {number} ReliabilityIndex
 * @property {string} RiskFlag
 */

/** @param {Project[]} projects */
async function createReport2(projects) {
  /** @type {ContractorPerformance[]} */
  let contractorPerformances = [];

  for (const [contractor, filteredProjects] of Object.entries(
    Object.groupBy(projects, ({ contractor }) => contractor),
  )) {
    if (!filteredProjects || filteredProjects.length < 5) {
      continue;
    }

    const totalCost = filteredProjects.map((p) => p.contractCost).reduce(...SUM);

    const completionDayDelays = filteredProjects.map((p) => p.completionDayDelays);
    const avgDelay = completionDayDelays.reduce(...SUM) / completionDayDelays.length;

    const totalSavings = filteredProjects.map((p) => p.costSavings).reduce(...SUM);

    const reliabilityIdx = Math.abs(Math.min(Math.max((1 - avgDelay / 90) * (totalSavings / totalCost) * 100, 0), 100));

    contractorPerformances.push({
      Rank: 0,
      Contractor: contractor,
      TotalCost: totalCost,
      NumProjects: filteredProjects.length,
      AvgDelay: avgDelay,
      TotalSavings: totalSavings,
      ReliabilityIndex: reliabilityIdx,
      RiskFlag: reliabilityIdx < 50 ? "High Risk" : "Low Risk",
    });
  }

  contractorPerformances = contractorPerformances
    .sort((a, b) => a.TotalCost - b.TotalCost)
    .slice(0, 15)
    .reverse();

  for (const [i, contractorPerf] of contractorPerformances.entries()) {
    contractorPerf.Rank = i + 1;
  }

  const fileName = "report2_contractor_ranking.csv";

  await writeFile(fileName, stringify(contractorPerformances, CSV_STRINGIFY_OPTIONS));

  console.log(`2. Top Contractors Performance Ranking (exported to ${fileName})`);
}

/**
 * @typedef ProjectOverrunTrend
 * @property {string} FundingYear
 * @property {string} TypeOfWork
 * @property {number} TotalProjects
 * @property {number} AvgSavings
 * @property {number} OverrunRate
 * @property {number} YoYChange
 */

/** @param {Project[]} projects */
async function createReport3(projects) {
  /** @type {ProjectOverrunTrend[]} */
  const projectOverrunTrends = [];

  for (const [year, p] of Object.entries(Object.groupBy(projects, ({ fundingYear }) => fundingYear))) {
    if (!p) {
      continue;
    }

    for (const [typeOfWork, filteredProjects] of Object.entries(Object.groupBy(p, ({ typeOfWork }) => typeOfWork))) {
      if (!filteredProjects) {
        continue;
      }

      const savings = filteredProjects.map((p) => p.costSavings);

      projectOverrunTrends.push({
        FundingYear: year,
        TypeOfWork: typeOfWork,
        TotalProjects: filteredProjects.length,
        AvgSavings: savings.reduce(...SUM) / savings.length,
        OverrunRate: (savings.filter((s) => s < 0).length / savings.length) * 100,
        YoYChange: 0,
      });
    }
  }

  projectOverrunTrends.sort((a, b) => {
    const yearDiff = Number(a.FundingYear) - Number(b.FundingYear);

    if (yearDiff !== 0) {
      return yearDiff;
    }

    return b.AvgSavings - a.AvgSavings;
  });

  const trendAvgSavings = new Map(projectOverrunTrends.values().map((t) => [Number(t.FundingYear), t.AvgSavings]));

  for (const trend of projectOverrunTrends) {
    if (Number(trend.FundingYear) <= 2021) {
      continue;
    }

    const prevAvgSavings = trendAvgSavings.entries().find((s) => s[0] === Number(trend.FundingYear) - 1);

    if (prevAvgSavings) {
      trend.YoYChange = ((trend.AvgSavings - prevAvgSavings[1]) / prevAvgSavings[1]) * 100;
    }
  }

  const fileName = "report3_annual_trends.csv";

  await writeFile(fileName, stringify(projectOverrunTrends, CSV_STRINGIFY_OPTIONS));

  console.log(`3. Annual Project Type Cost Overrun Trends (exported to ${fileName})`);
}

/**
 * @typedef Summary
 * @property {number} TotalProjects
 * @property {number} TotalContractors
 * @property {number} GlobalAvgDelay
 * @property {number} TotalSavings
 */

/** @param {Project[]} projects */
async function createSummary(projects) {
  const completionDelayDays = projects.map((p) => p.completionDayDelays);
  const avgDelay = completionDelayDays.reduce(...SUM) / completionDelayDays.length;

  /** @type {Summary} */
  const summary = {
    TotalProjects: projects.length,
    TotalContractors: new Set(projects.filter((p) => p.contractId)).size,
    GlobalAvgDelay: avgDelay,
    TotalSavings: projects
      .values()
      .map((p) => p.costSavings)
      .reduce(...SUM),
  };
  const jsonSummary = JSON.stringify(summary, null, 2);

  await writeFile("summary.json", jsonSummary, "utf-8");
}

void (async function main() {
  const projects = await parse_project_csv_records();

  if (projects.length === 0) {
    return;
  }

  console.log();

  console.log("Generating reports...");

  await createReport1(projects);
  await createReport2(projects);
  await createReport3(projects);

  console.log();

  process.stdout.write("Generating summary...");

  await createSummary(projects);

  console.log("  (exported to summary.json)");
})();
