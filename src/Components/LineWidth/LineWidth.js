import React from "react";
import { roundTo } from "../../util/math";
import { hexToHSL } from "../../util/color";
import { Table, InputNumber, Form } from "antd";

const DEFAULT_NOZZLE_DIAMETER = 0.4;
const DEFAULT_NOZZLE_FLAT_SIZE = 0.6;
const DEFAULT_IDEAL_LAYER_HEIGHT_STEP = 0.04;

const SAFETY_DETERMINATIONS = {
  SAFE: "safe",
  WARNING: "warning",
  DANGER: "danger",
};

const SAFETY_COLORS = {
  [SAFETY_DETERMINATIONS.SAFE]: "#0f0",
  [SAFETY_DETERMINATIONS.WARNING]: "#ff0",
  [SAFETY_DETERMINATIONS.DANGER]: "#f00",
};

const getSafetyColor = (key) => SAFETY_COLORS[key] || key;

const determineLayerHeightSafety = (layerHeight, nozzleDiameter) => {
  const ratio = layerHeight / nozzleDiameter;

  if (ratio <= 0.8) {
    return SAFETY_DETERMINATIONS.SAFE;
  }

  if (ratio <= 1.5) {
    return SAFETY_DETERMINATIONS.WARNING;
  }

  return SAFETY_DETERMINATIONS.DANGER;
};

const determineLineWidthSafety = (
  lineWidth,
  layerHeight,
  nozzleDiameter,
  nozzleFlatSize
) => {
  const minLineWidth = layerHeight + nozzleDiameter;
  const maxLineWidth = layerHeight + nozzleFlatSize;

  if (lineWidth < 0.5 * minLineWidth || lineWidth > maxLineWidth) {
    return SAFETY_DETERMINATIONS.DANGER;
  }

  if (lineWidth < minLineWidth) {
    const maxAllowableDelta = 0.5 * minLineWidth;
    const delta = minLineWidth - lineWidth;

    const deltaRatio = delta / maxAllowableDelta;

    const shift = (deltaRatio - 0.5) / 0.5;
    const shiftHex = Math.round((1 - Math.abs(shift)) * 15).toString(16);

    console.log(shift, Math.abs(1 - shift), shiftHex);

    if (shift > 0) {
      return `#f${shiftHex}0`;
    }

    if (shift < 0) {
      return `#${shiftHex}f0`;
    }

    return "#ff0";
    //return SAFETY_DETERMINATIONS.WARNING;
  }

  return SAFETY_DETERMINATIONS.SAFE;
};

const cylinderVolume = (radius, height) =>
  Math.PI * Math.pow(radius, 2) * height;

const calculateIdealLineWidth = (nozzleDiameter, layerHeight) =>
  2 *
  Math.sqrt((nozzleDiameter / layerHeight) * Math.pow(nozzleDiameter / 2, 2));

export function LineWidth() {
  const [nozzleDiameter, setNozzleDiameter] = React.useState(
    DEFAULT_NOZZLE_DIAMETER
  );
  const [nozzleFlatSize, setNozzleFlatSize] = React.useState(
    DEFAULT_NOZZLE_FLAT_SIZE
  );
  const [idealLayerHeightStep, setIdealLayerHeightStep] = React.useState(
    DEFAULT_IDEAL_LAYER_HEIGHT_STEP
  );

  const outputVolume = React.useMemo(
    () => cylinderVolume(nozzleDiameter / 2, nozzleDiameter),
    [nozzleDiameter]
  );

  const layerHeights = React.useMemo(() => {
    const heights = [];

    for (
      let i = idealLayerHeightStep;
      i <= nozzleDiameter * 1.6;
      i += idealLayerHeightStep
    ) {
      heights.push(i);
    }

    return heights;
  }, [idealLayerHeightStep, nozzleDiameter]);

  const tableRecords = React.useMemo(
    () =>
      layerHeights.map((layerHeight) => {
        const idealLineWidth = calculateIdealLineWidth(
          nozzleDiameter,
          layerHeight
        );

        const minLineWidth = layerHeight + nozzleDiameter;
        const maxLineWidth = layerHeight + nozzleFlatSize;

        const minExtrusionVolume = cylinderVolume(
          minLineWidth / 2,
          layerHeight
        );
        const minVolumeDelta = (minExtrusionVolume / outputVolume - 1) * 100;

        const maxExtrusionVolume = cylinderVolume(
          maxLineWidth / 2,
          layerHeight
        );
        const maxVolumeDelta = (maxExtrusionVolume / outputVolume - 1) * 100;

        const layerHeightSafetyColor =
          SAFETY_COLORS[
            determineLayerHeightSafety(layerHeight, nozzleDiameter)
          ];

        const lineWidthSafetyColor = getSafetyColor(
          determineLineWidthSafety(
            idealLineWidth,
            layerHeight,
            nozzleDiameter,
            nozzleFlatSize
          )
        );

        const worstSafetyDetermination = (() => {
          const danger = SAFETY_COLORS[SAFETY_DETERMINATIONS.DANGER];
          const warning = SAFETY_COLORS[SAFETY_DETERMINATIONS.WARNING];
          const safe = SAFETY_COLORS[SAFETY_DETERMINATIONS.SAFE];

          if (
            layerHeightSafetyColor === danger ||
            lineWidthSafetyColor === danger
          ) {
            return danger;
          }

          if (!Object.values(SAFETY_COLORS).includes(lineWidthSafetyColor)) {
            return lineWidthSafetyColor;
          }

          if (
            layerHeightSafetyColor === warning ||
            lineWidthSafetyColor === warning
          ) {
            return warning;
          }

          return safe;
        })();

        const notes = (() => {
          if (idealLineWidth > maxLineWidth) {
            const percentOverSpec = (idealLineWidth / maxLineWidth - 1) * 100;
            return `Ideal Line Width is ${roundTo(
              percentOverSpec,
              2
            )}% over Maximum Line Width. Material will tend to collect on the nozzle and be dragged around the print.`;
          }

          if (idealLineWidth < 0.5 * minLineWidth) {
            const percentUnderSpec = (1 - idealLineWidth / minLineWidth) * 100;
            return `Ideal Line Width is ${roundTo(
              percentUnderSpec,
              2
            )}% under Minimum Line Width. Print will be extremely weak due to insufficient extruded material required to properly adhere layers together.`;
          }

          if (idealLineWidth < minLineWidth) {
            const percentUnderSpec = (1 - idealLineWidth / minLineWidth) * 100;
            return `Ideal Line Width is ${roundTo(
              percentUnderSpec,
              2
            )}% under Minimum Line Width. Print will preserve more detail in the X/Y planes at the cost of strength.`;
          }

          return "Ideal Line Width is within spec. Print will have maximum possible strength while preserving features and dimensional accuracy.";
        })();

        console.log(
          layerHeightSafetyColor,
          lineWidthSafetyColor,
          worstSafetyDetermination
        );

        const rowColor = hexToHSL(worstSafetyDetermination, null, null, 90);

        return {
          layerHeight: roundTo(layerHeight, 2),
          layerHeightSafetyColor,
          idealLineWidth: roundTo(idealLineWidth, 3),
          lineWidthSafetyColor,
          rowColor,
          minLineWidth: roundTo(minLineWidth, 2),
          maxLineWidth: roundTo(maxLineWidth, 2),
          minExtrusionVolume: roundTo(minExtrusionVolume, 3),
          minVolumeDelta: `${minVolumeDelta > 0 ? "+" : ""}${roundTo(
            minVolumeDelta,
            2
          )}%`,
          maxExtrusionVolume: roundTo(maxExtrusionVolume, 3),
          maxVolumeDelta: `${maxVolumeDelta > 0 ? "+" : ""}${roundTo(
            maxVolumeDelta,
            2
          )}%`,
          notes,
        };
      }),
    [layerHeights, nozzleDiameter, nozzleFlatSize, outputVolume]
  );

  const renderCellBackground = (value, { rowColor }) => ({
    props: {
      style: { background: rowColor },
    },
    children: <div>{value}</div>,
  });

  const columns = [
    {
      title: "Layer Height",
      dataIndex: "layerHeight",
      render: (value, { layerHeightSafetyColor }) => ({
        props: {
          style: { background: layerHeightSafetyColor },
        },
        children: <div>{value}</div>,
      }),
    },
    {
      title: "Min Line Width",
      dataIndex: "minLineWidth",
      render: renderCellBackground,
    },
    {
      title: "Min Δ Ideal Extrusion Volume",
      dataIndex: "minExtrusionVolume",
      render: renderCellBackground,
    },
    {
      title: "Min Volume Delta",
      dataIndex: "minVolumeDelta",
      render: renderCellBackground,
    },
    {
      title: "Ideal Line Width",
      dataIndex: "idealLineWidth",
      render: (value, { lineWidthSafetyColor }) => ({
        props: {
          style: { background: lineWidthSafetyColor },
        },
        children: <div>{value}</div>,
      }),
    },
    {
      title: "Max Line Width",
      dataIndex: "maxLineWidth",
      render: renderCellBackground,
    },
    {
      title: "Max Extrusion Volume",
      dataIndex: "maxExtrusionVolume",
      render: renderCellBackground,
    },
    {
      title: "Max Δ Ideal Volume Delta",
      dataIndex: "maxVolumeDelta",
      render: renderCellBackground,
    },
    {
      title: "Notes",
      dataIndex: "notes",
      render: renderCellBackground,
    },
  ];

  return (
    <>
      <Form>
        <Form.Item label="Ideal Layer Height Step">
          <InputNumber
            value={idealLayerHeightStep}
            onChange={(e) => {
              const floatValue = parseFloat(e.target.value);

              if (isNaN(floatValue)) {
                return;
              }

              setIdealLayerHeightStep(floatValue);
            }}
            step={0.01}
          />
        </Form.Item>
        <Form.Item label="Nozzle Diameter">
          <InputNumber
            value={nozzleDiameter}
            onChange={(e) => {
              const floatValue = parseFloat(e.target.value);

              if (isNaN(floatValue)) {
                return;
              }

              setNozzleDiameter(floatValue);
            }}
            step={0.05}
          />
        </Form.Item>
        <Form.Item label="Constant Output Volume">
          {roundTo(outputVolume, 3)}
        </Form.Item>
        <Form.Item label="Nozzle Flat Size">
          <InputNumber
            type="number"
            value={nozzleFlatSize}
            onChange={(e) => {
              const floatValue = parseFloat(e.target.value);

              if (isNaN(floatValue)) {
                return;
              }

              setNozzleFlatSize(floatValue);
            }}
            step={0.01}
          />
        </Form.Item>
      </Form>
      <Table dataSource={tableRecords} columns={columns} pagination={false} />
    </>
  );
}
