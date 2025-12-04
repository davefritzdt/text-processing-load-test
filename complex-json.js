const fs = require('fs');
const yaml = require('yaml');

function generateLargeObject(targetSize, format) {
	// Target 98% of specified size to stay slightly under
	const TARGET_BYTES = targetSize * 1024 * 1024 * 0.98;

	// Validate format
	if (!['json', 'yaml'].includes(format.toLowerCase())) {
		throw new Error('Format must be either "json" or "yaml"');
	}

	const formatLower = format.toLowerCase();

	// Helper function to estimate string size in bytes
	function getByteSize(str) {
		return Buffer.byteLength(str, 'utf8');
	}

	// Generate a simple object with padding data
	function generateLevelData(depth) {
		return {
			value: `Data at depth ${depth}: ${'x'.repeat(1000)}` // Padding to help reach target size
		};
	}

	// Build object until target size is reached
	function buildToTargetSize() {
		let root = generateLevelData(0);
		let current = root;
		let depth = 0;
		let lastValidRoot = null;
		let lastValidDepth = 0;

		while (true) {
			// Serialize current state to check size
			const serialized = formatLower === 'json'
				? JSON.stringify(root, null, 2)
				: yaml.stringify(root);

			const currentBytes = getByteSize(serialized);

			if (currentBytes >= TARGET_BYTES) {
				// Use the last valid state that was under target
				if (lastValidRoot) {
					return { root: lastValidRoot, depth: lastValidDepth };
				}
				break;
			}

			// Save current state as last valid
			lastValidRoot = JSON.parse(JSON.stringify(root)); // Deep clone
			lastValidDepth = depth;

			// Add another nested level
			depth++;
			current.nested = generateLevelData(depth);
			current = current.nested;

			// Safety check to prevent infinite loops
			if (depth > 100000) {
				console.warn('Reached maximum depth limit');
				break;
			}
		}

		return { root, depth };
	}

	// Find deepest path in the object
	function findDeepestPath(obj, currentPath = []) {
		let deepestPath = currentPath;
		let maxDepth = currentPath.length;

		for (const [key, value] of Object.entries(obj)) {
			if (value && typeof value === 'object' && !Array.isArray(value)) {
				const newPath = [...currentPath, key];
				const result = findDeepestPath(value, newPath);

				if (result.length > maxDepth) {
					deepestPath = result;
					maxDepth = result.length;
				}
			}
		}

		return deepestPath;
	}

	// Generate the object
	console.log(`Generating ${formatLower.toUpperCase()} object with target size: ~${targetSize}MB...`);
	const startTime = Date.now();

	const { root: generatedObject } = buildToTargetSize();

	// Find deepest path
	const deepestPath = findDeepestPath(generatedObject);
	const deepestPathString = '.' + deepestPath.join('.');

	// Add the deepest path to the root object
	generatedObject.deepestPath = deepestPathString;

	// Convert to requested format
	let output;
	if (formatLower === 'json') {
		output = JSON.stringify(generatedObject, null, 2);
	} else {
		output = yaml.stringify(generatedObject);
	}

	// Get actual size
	const actualSize = (getByteSize(output) / (1024 * 1024)).toFixed(2);
	const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);

	console.log(`Generated in ${generationTime}s`);
	console.log(`Actual size: ${actualSize}MB`);
	console.log(`Deepest path (depth ${deepestPath.length}): ${deepestPathString}`);

	// Save to file
	const fileName = `result_${targetSize}MB.${formatLower}`;
	fs.writeFileSync(fileName, output, 'utf8');
	console.log(`File saved as: ${fileName}`);

	return {
		output: output,
		deepestPath: deepestPathString,
		depth: deepestPath.length,
		actualSizeMB: parseFloat(actualSize),
		format: formatLower,
		fileName: fileName
	};
}

// Get CLI arguments
const format = process.argv[2];
const size = parseFloat(process.argv[3]);

if (!format || !size) {
	console.error('Usage: node script.js <format> <size>');
	console.error('Example: node script.js json 5');
	process.exit(1);
}

const result = generateLargeObject(size, format);
console.log('Deepest path:', result.deepestPath);
