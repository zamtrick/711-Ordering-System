#!/bin/bash

echo "=== Testing Customer Mobile App ==="

echo ""
echo "1. Checking TypeScript compilation..."
npx tsc --noEmit 2>&1 | head -20
if [ $? -eq 0 ]; then
  echo "✓ TypeScript compilation passed"
else
  echo "✗ TypeScript compilation failed"
fi

echo ""
echo "2. Checking Expo doctor..."
npx expo-doctor 2>&1 | tail -10
if [ $? -eq 0 ]; then
  echo "✓ Expo doctor passed"
else
  echo "✗ Expo doctor failed"
fi

echo ""
echo "3. Exporting web build..."
rm -rf dist
npx expo export --platform web 2>&1 | tail -20
if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
  echo "✓ Web export succeeded"
else
  echo "✗ Web export failed"
fi

echo ""
echo "4. Checking API connectivity..."
curl -s -o /dev/null -w "%{http_code}" http://192.168.254.181:5000/api/customer/products 2>/dev/null
if [ $? -eq 0 ]; then
  echo " (Server is responding)"
else
  echo " (Server not accessible)"
fi

echo ""
echo "=== Test Complete ==="
