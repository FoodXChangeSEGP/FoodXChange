import { View, Text } from 'react-native';


export default function ProductCard({ product }: any) {
return (
    <View style={{ backgroundColor: '#fff', padding: 12, marginVertical: 8 }}>
    <Text style={{ fontSize: 18 }}>{product.name}</Text>
    <Text>NOVA: {product.nova_score}</Text>
    {product.prices.map((p: any, i: number) => (
    <Text key={i}>{p.retailer}: £{p.price}</Text>
    ))}
    </View>
    );
}