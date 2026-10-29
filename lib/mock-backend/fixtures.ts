import type {
  Robot,
  RobotKind,
  RobotModel,
  Site,
  SiteMap,
  TaskType,
  Waypoint,
  WaypointType,
  Zone,
} from "@/lib/api/types";

export const ROBOT_MODELS = {
  c1: { id: "c1", name: "Carrier C1", kind: "amr", maxSpeed: 1.5, maxPayloadKg: 100, batteryCapacityKWh: 1.2 },
  t3: { id: "t3", name: "Tugger T3", kind: "tugger", maxSpeed: 2, maxPayloadKg: 1000, batteryCapacityKWh: 4.8 },
  l2: { id: "l2", name: "Lift L2", kind: "forklift", maxSpeed: 1.2, maxPayloadKg: 1500, batteryCapacityKWh: 9.6 },
} satisfies Record<string, RobotModel>;

/** Which waypoints each kind of robot shuttles between. */
export const TASK_RULES: Record<RobotKind, { type: TaskType; from: WaypointType[]; to: WaypointType[] }> = {
  amr: { type: "tote_delivery", from: ["rack"], to: ["station"] },
  tugger: { type: "cart_tow", from: ["dock", "station"], to: ["station", "dock"] },
  forklift: { type: "pallet_move", from: ["dock", "rack"], to: ["rack", "dock"] },
};

interface Layout {
  width: number;
  height: number;
  /** Per side: inbound and outbound. */
  docks: number;
  rackRows: number;
  rackColumns: number;
  stations: number;
}

interface SiteFixture {
  site: Site;
  layout: Layout;
  fleet: (keyof typeof ROBOT_MODELS)[];
}

const SITE_FIXTURES: SiteFixture[] = [
  {
    site: {
      id: "muc-freimann",
      name: "Freimann Fulfillment Center",
      location: { city: "Munich", country: "DE", lat: 48.2007, lng: 11.6132 },
      timezone: "Europe/Berlin",
    },
    layout: { width: 100, height: 70, docks: 4, rackRows: 4, rackColumns: 8, stations: 5 },
    fleet: ["c1", "c1", "c1", "c1", "c1", "c1", "c1", "t3", "t3", "t3", "l2", "l2"],
  },
  {
    site: {
      id: "muc-riem",
      name: "Riem Cross-Dock",
      location: { city: "Munich", country: "DE", lat: 48.1318, lng: 11.6935 },
      timezone: "Europe/Berlin",
    },
    layout: { width: 80, height: 56, docks: 5, rackRows: 3, rackColumns: 6, stations: 3 },
    fleet: ["c1", "c1", "t3", "t3", "t3", "l2", "l2", "l2"],
  },
  {
    site: {
      id: "muc-schwabing",
      name: "Schwabing Micro-Fulfillment",
      location: { city: "Munich", country: "DE", lat: 48.1622, lng: 11.5866 },
      timezone: "Europe/Berlin",
    },
    layout: { width: 48, height: 44, docks: 2, rackRows: 2, rackColumns: 5, stations: 3 },
    fleet: ["c1", "c1", "c1", "c1", "c1", "c1"],
  },
];

// prettier-ignore
const ROBOT_NAMES = [
  "Atlas", "Bishop", "Comet", "Dash", "Echo", "Ferris", "Gizmo", "Hopper", "Iris", "Juno", "Kepler", "Luna", "Milo",
  "Nova", "Otto", "Pixel", "Quill", "Rover", "Sprocket", "Tycho", "Ursa", "Vega", "Watt", "Xeno", "Yuki", "Zephyr",
];

/** Depth of the dock band at the top and the packing/charging band at the bottom, in metres. */
const BAND = 10;

/** Generates a simple warehouse: docks on top, storage in the middle, packing and charging at the bottom. */
function buildMap({ width, height, docks, rackRows, rackColumns, stations }: Layout, chargers: number): SiteMap {
  const half = width / 2;
  const bottom = height - BAND;
  const storage = { x: 4, y: BAND + 4, width: width - 8, height: height - 2 * BAND - 8 };
  const charging = { x: width * 0.55, width: width * 0.3 };

  const zones: Zone[] = [
    { id: "inbound", name: "Inbound", type: "inbound", x: 0, y: 0, width: half, height: BAND },
    { id: "outbound", name: "Outbound", type: "outbound", x: half, y: 0, width: half, height: BAND },
    { id: "storage", name: "Storage", type: "storage", ...storage },
    { id: "packing", name: "Packing", type: "packing", x: 0, y: bottom, width: charging.x, height: BAND },
    {
      id: "charging",
      name: "Charging",
      type: "charging",
      x: charging.x,
      y: bottom,
      width: charging.width,
      height: BAND,
    },
    {
      id: "maintenance",
      name: "Maintenance bay",
      type: "restricted",
      x: charging.x + charging.width,
      y: bottom,
      width: width - charging.x - charging.width,
      height: BAND,
    },
  ];

  const waypoints: Waypoint[] = [
    ...spread(docks, 0, half).map((x, i) => waypoint(`in-${i + 1}`, `Inbound Dock ${i + 1}`, "dock", x, BAND / 2)),
    ...spread(docks, half, half).map((x, i) => waypoint(`out-${i + 1}`, `Outbound Dock ${i + 1}`, "dock", x, BAND / 2)),
  ];
  spread(rackRows, storage.y, storage.height).forEach((y, row) => {
    const letter = String.fromCharCode(65 + row);
    spread(rackColumns, storage.x, storage.width).forEach((x, column) => {
      waypoints.push(
        waypoint(`rack-${letter.toLowerCase()}${column + 1}`, `Rack ${letter}${column + 1}`, "rack", x, y),
      );
    });
  });
  spread(stations, 0, charging.x).forEach((x, i) => {
    waypoints.push(waypoint(`station-${i + 1}`, `Pack Station ${i + 1}`, "station", x, bottom + BAND / 2));
  });
  const chargerRows = chargers > 6 ? 2 : 1;
  const perRow = Math.ceil(chargers / chargerRows);
  for (let i = 0; i < chargers; i++) {
    const x = charging.x + ((i % perRow) + 0.5) * (charging.width / perRow);
    const y = bottom + (Math.floor(i / perRow) + 0.5) * (BAND / chargerRows);
    waypoints.push(waypoint(`charger-${i + 1}`, `Charger ${i + 1}`, "charger", x, y));
  }

  return {
    width,
    height,
    zones: zones.map((zone) => ({
      ...zone,
      x: round(zone.x),
      y: round(zone.y),
      width: round(zone.width),
      height: round(zone.height),
    })),
    waypoints,
  };
}

/** Centres of `count` equal slots along [start, start + length). */
function spread(count: number, start: number, length: number) {
  return Array.from({ length: count }, (_, i) => start + ((i + 0.5) * length) / count);
}

function waypoint(id: string, name: string, type: WaypointType, x: number, y: number): Waypoint {
  return { id, name, type, x: round(x), y: round(y) };
}

/** Map coordinates are kept to 0.1 m. */
const round = (value: number) => Math.round(value * 10) / 10;

export const SITES: { site: Site; map: SiteMap }[] = SITE_FIXTURES.map(({ site, layout, fleet }) => ({
  site,
  map: buildMap(layout, fleet.length),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

export const ROBOTS: Robot[] = SITE_FIXTURES.flatMap(({ site, fleet }) =>
  fleet.map((modelId, i) => ({ site, modelId, i })),
).map(({ site, modelId, i }, index) => {
  const n = index + 1;
  const model = ROBOT_MODELS[modelId];
  const commissionedAt = new Date(Date.UTC(2023, 2, 1) + n * 41 * DAY_MS);
  return {
    id: `rbt-${String(n).padStart(3, "0")}`,
    name: ROBOT_NAMES[index],
    serialNumber: `${model.id.toUpperCase()}-${commissionedAt.getUTCFullYear()}-${String(1000 + n * 37).padStart(5, "0")}`,
    siteId: site.id,
    model,
    // A few robots lag behind on firmware, which a fleet view may want to flag.
    firmwareVersion: n % 5 === 3 ? "4.1.7" : "4.2.1",
    commissionedAt: commissionedAt.toISOString(),
    homeChargerId: `charger-${i + 1}`,
  };
});

export const SITE_IDS = SITES.map(({ site }) => site.id);
export const ROBOT_IDS = ROBOTS.map((robot) => robot.id);
