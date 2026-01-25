import { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { fetchProducts } from '../api';
import ProductCard from '../components/ProductCard';


export default function ProductListScreen() {
const [products, setProducts] = useState([]);


useEffect(() => {
    fetchProducts().then(setProducts);
}, []);


return (
    <View style={{ padding: 16 }}>
    <Text style={{ fontSize: 28, fontWeight: 'bold' }}>FoodX</Text>
    <FlatList
    data={products}
    keyExtractor={(item: any) => item.id.toString()}
    renderItem={({ item }) => <ProductCard product={item} />}
    />
    </View>
    );
}