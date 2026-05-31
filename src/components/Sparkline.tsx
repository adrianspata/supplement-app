import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SparklineProps {
  data: number[]; // Array of scores, e.g. [3, 4, 0, 5, 2] where 0 is unlogged
  color?: string;
  gradientColors?: string[];
  height?: number;
}

export function Sparkline({
  data,
  color = '#1D1D1F',
  gradientColors = ['rgba(29, 29, 31, 0.15)', 'rgba(29, 29, 31, 0)'],
  height = 50
}: SparklineProps) {
  const containerWidth = Dimensions.get('window').width - 80; // Card padding accounts for 80px

  // Clean data: replace 0 (unlogged) with the average or last known value so the line doesn't drop to zero.
  const loggedPoints = data.filter(v => v > 0);
  const avgValue = loggedPoints.length > 0 ? loggedPoints.reduce((a, b) => a + b, 0) / loggedPoints.length : 3;

  const processedData = data.map((v, i) => {
    if (v > 0) return v;
    // Find nearest neighbor or fallback to average
    let left = -1, right = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (data[j] > 0) { left = data[j]; break; }
    }
    for (let j = i + 1; j < data.length; j++) {
      if (data[j] > 0) { right = data[j]; break; }
    }
    if (left !== -1 && right !== -1) return (left + right) / 2;
    if (left !== -1) return left;
    if (right !== -1) return right;
    return avgValue;
  });

  const pointsCount = processedData.length;
  if (pointsCount < 2) return null;

  // SVG coordinate calculations
  const paddingX = 4;
  const paddingY = 8;
  const svgWidth = containerWidth;
  const svgHeight = height;

  const minVal = 1;
  const maxVal = 5;
  const valRange = maxVal - minVal;

  const getX = (index: number) => {
    return paddingX + (index / (pointsCount - 1)) * (svgWidth - 2 * paddingX);
  };

  const getY = (value: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, value));
    // SVG coordinates start from top-left (0,0)
    return svgHeight - paddingY - ((clamped - minVal) / valRange) * (svgHeight - 2 * paddingY);
  };

  // Generate SVG Path
  let pathD = '';
  let areaD = '';

  processedData.forEach((val, index) => {
    const x = getX(index);
    const y = getY(val);
    if (index === 0) {
      pathD = `M ${x} ${y}`;
      areaD = `M ${x} ${svgHeight} L ${x} ${y}`;
    } else {
      // Smooth out the line using cubic bezier control points if we want a curved look
      const prevX = getX(index - 1);
      const prevY = getY(processedData[index - 1]);
      const cpX1 = prevX + (x - prevX) / 2;
      const cpY1 = prevY;
      const cpX2 = prevX + (x - prevX) / 2;
      const cpY2 = y;
      
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
      areaD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
    }

    if (index === pointsCount - 1) {
      areaD += ` L ${x} ${svgHeight} Z`;
    }
  });

  // Unique ID for gradient so multiple sparklines don't conflict
  const gradientId = `gradient-${color.replace('#', '')}-${pointsCount}`;

  return (
    <View style={[styles.container, { height }]}>
      <Svg width={svgWidth} height={svgHeight}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={gradientColors[0]} />
            <Stop offset="100%" stopColor={gradientColors[1]} />
          </LinearGradient>
        </Defs>

        {/* Fill Area */}
        <Path d={areaD} fill={`url(#${gradientId})`} />

        {/* Trend Line */}
        <Path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
});
