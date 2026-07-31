import React, { useEffect } from 'react';
import { ViewStyle, StyleSheet, Dimensions, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height: height as any,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

// Ready-made skeletons for Home Screen
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CategorySkeleton = React.memo(() => (
  <Animated.View style={{ alignItems: 'center', marginRight: 18, width: 64 }}>
    <SkeletonLoader width={60} height={60} borderRadius={16} />
    <SkeletonLoader width={48} height={12} borderRadius={6} style={{ marginTop: 6 }} />
  </Animated.View>
));

export const FoodCardSkeleton = React.memo(() => (
  <Animated.View style={styles.foodCardItem}>
    <SkeletonLoader width="100%" height={110} borderRadius={12} />
    <SkeletonLoader width="80%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
    <View style={styles.foodItemFooter}>
      <SkeletonLoader width="40%" height={14} borderRadius={6} />
      <SkeletonLoader width={24} height={24} borderRadius={12} />
    </View>
  </Animated.View>
));

export const RestaurantSkeleton = React.memo(() => (
  <Animated.View style={styles.restaurantCardItem}>
    <SkeletonLoader width={260} height={140} borderRadius={16} />
    <SkeletonLoader width={180} height={16} borderRadius={8} style={{ marginTop: 12, marginHorizontal: 12 }} />
    <SkeletonLoader width={120} height={12} borderRadius={6} style={{ marginTop: 8, marginHorizontal: 12 }} />
  </Animated.View>
));

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E5E7EB',
  },
  foodCardItem: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  foodItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  restaurantCardItem: {
    width: 260,
    marginRight: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingBottom: 16,
  }
});

export const OrderCardSkeleton = React.memo(() => (
  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F3F4F6' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SkeletonLoader width={40} height={40} borderRadius={20} />
        <View style={{ marginLeft: 12 }}>
          <SkeletonLoader width={120} height={16} borderRadius={6} style={{ marginBottom: 6 }} />
          <SkeletonLoader width={80} height={12} borderRadius={4} />
        </View>
      </View>
      <SkeletonLoader width={60} height={24} borderRadius={12} />
    </View>
    <View style={{ backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, marginBottom: 12 }}>
      <SkeletonLoader width="90%" height={14} borderRadius={4} style={{ marginBottom: 6 }} />
      <SkeletonLoader width="60%" height={14} borderRadius={4} />
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <SkeletonLoader width={80} height={14} borderRadius={4} />
      <SkeletonLoader width={100} height={36} borderRadius={18} />
    </View>
  </View>
));

export const ProductDetailSkeleton = React.memo(() => (
  <View style={{ flex: 1, backgroundColor: '#F8F8F8' }}>
    <SkeletonLoader width="100%" height={320} borderRadius={0} />
    <View style={{ padding: 20, backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30 }}>
      <SkeletonLoader width="60%" height={28} borderRadius={8} style={{ marginBottom: 10 }} />
      <SkeletonLoader width="30%" height={20} borderRadius={6} style={{ marginBottom: 20 }} />
      <SkeletonLoader width="100%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="90%" height={16} borderRadius={6} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="80%" height={16} borderRadius={6} style={{ marginBottom: 24 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
        <SkeletonLoader width="40%" height={50} borderRadius={25} />
        <SkeletonLoader width="50%" height={50} borderRadius={25} />
      </View>
    </View>
  </View>
));

export const RestaurantHeaderSkeleton = React.memo(() => (
  <View style={{ backgroundColor: '#F8F8F8' }}>
    <SkeletonLoader width="100%" height={220} borderRadius={0} />
    <View style={{ padding: 20, backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30, alignItems: 'center' }}>
      <SkeletonLoader width={80} height={80} borderRadius={40} style={{ marginTop: -40, marginBottom: 12, borderWidth: 4, borderColor: '#FFF' }} />
      <SkeletonLoader width="50%" height={24} borderRadius={8} style={{ marginBottom: 8 }} />
      <SkeletonLoader width="30%" height={16} borderRadius={6} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <SkeletonLoader width={80} height={36} borderRadius={18} />
        <SkeletonLoader width={80} height={36} borderRadius={18} />
        <SkeletonLoader width={80} height={36} borderRadius={18} />
      </View>
    </View>
  </View>
));
