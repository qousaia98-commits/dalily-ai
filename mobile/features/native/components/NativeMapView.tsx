import React, { useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { MapMarker } from '../types';
import { logMapInteraction } from '../maps/utils';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Props = {
  markers?: MapMarker[];
  route?: { latitude: number; longitude: number }[];
  coverageCenter?: { latitude: number; longitude: number };
  coverageRadiusM?: number;
  initial?: { latitude: number; longitude: number };
  onPick?: (coord: { latitude: number; longitude: number }) => void;
  editable?: boolean;
  height?: number;
};

export function NativeMapView({
  markers = [],
  route,
  coverageCenter,
  coverageRadiusM,
  initial,
  onPick,
  editable,
  height = 240,
}: Props) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const center = initial ?? markers[0]?.coordinate ?? { latitude: 31.9539, longitude: 35.9106 };

  return (
    <View style={[styles.wrap, { height, borderColor: colors.border }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          ...center,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        onPress={(e) => {
          if (!editable || !onPick) return;
          const { latitude, longitude } = e.nativeEvent.coordinate;
          onPick({ latitude, longitude });
          logMapInteraction('pick', { latitude, longitude });
        }}
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={m.coordinate}
            title={m.title}
            description={m.subtitle}
          />
        ))}
        {route && route.length > 1 ? (
          <Polyline coordinates={route} strokeColor={colors.primary} strokeWidth={3} />
        ) : null}
        {coverageCenter && coverageRadiusM ? (
          <Circle
            center={coverageCenter}
            radius={coverageRadiusM}
            strokeColor={colors.primary}
            fillColor={`${colors.primary}22`}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: spacing.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
