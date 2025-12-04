import { writeFileSync } from 'fs';
import { stringify } from 'yaml';

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

	// Generate a single document for YAML
	function generateDocument(docNumber, totalDocs = null) {
		const doc = {
			documentId: docNumber,
			timestamp: new Date().toISOString(),
			data: {
				field1: `Document ${docNumber} - Field 1: ${'x'.repeat(500)}`,
				field2: `Document ${docNumber} - Field 2: ${'y'.repeat(500)}`,
				field3: `Document ${docNumber} - Field 3: ${'z'.repeat(500)}`,
				metadata: {
					author: `Author ${docNumber}`,
					tags: [`tag${docNumber}`, `category${docNumber % 10}`, 'general'],
					description: `This is document number ${docNumber} with some padding: ${'a'.repeat(300)}`
				},
				content: {
					title: `Title for document ${docNumber}`,
					body: `Body content for document ${docNumber}: ${'b'.repeat(800)}`,
					footer: `Footer for document ${docNumber}: ${'c'.repeat(200)}`
				}
			}
		};

		// Add totalDocuments field to the first document
		if (docNumber === 1 && totalDocs !== null) {
			doc.totalDocuments = totalDocs;
		}

		return doc;
	}

	// Build object until target size is reached (for JSON - deep nesting)
	function buildToTargetSize() {
		let root = generateLevelData(0);
		let current = root;
		let depth = 0;
		let lastValidRoot = null;
		let lastValidDepth = 0;

		while (true) {
			const serialized = JSON.stringify(root, null, 2);
			const currentBytes = getByteSize(serialized);

			if (currentBytes >= TARGET_BYTES) {
				if (lastValidRoot) {
					return { root: lastValidRoot, depth: lastValidDepth };
				}
				break;
			}

			lastValidRoot = JSON.parse(JSON.stringify(root));
			lastValidDepth = depth;

			depth++;
			current.nested = generateLevelData(depth);
			current = current.nested;

			if (depth > 100000) {
				console.warn('Reached maximum depth limit');
				break;
			}
		}

		return { root, depth };
	}

	// Build multiple YAML documents until target size is reached
	function buildYamlDocuments() {
		const documents = [];
		let docNumber = 0;

		while (true) {
			docNumber++;
			// Generate document without totalDocuments first
			documents.push(generateDocument(docNumber));

			// Serialize all documents to check size
			const serialized = documents.map(doc => stringify(doc)).join('---\n');
			const currentBytes = getByteSize(serialized);

			if (currentBytes >= TARGET_BYTES) {
				// Remove the last document if we exceeded the target
				if (documents.length > 1) {
					documents.pop();
				}
				break;
			}

			// Safety check
			if (docNumber > 1000000) {
				console.warn('Reached maximum document limit');
				break;
			}
		}

		// Now update the first document with the total count
		const finalCount = documents.length;
		documents[0] = generateDocument(1, finalCount);

		return { documents, count: finalCount };
	}

	// Find deepest path in the object (for JSON)
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

	let output;
	let deepestPathString;
	let depth;

	if (formatLower === 'json') {
		// JSON: Use deep nesting approach
		const { root: generatedObject } = buildToTargetSize();
		const deepestPath = findDeepestPath(generatedObject);
		deepestPathString = '.' + deepestPath.join('.');
		depth = deepestPath.length;

		generatedObject.deepestPath = deepestPathString;
		output = JSON.stringify(generatedObject, null, 2);
	} else {
		// YAML: Use multiple documents approach
		const { documents, count } = buildYamlDocuments();

		// Join documents with YAML document separator
		output = documents.map(doc => stringify(doc)).join('---\n');

		deepestPathString = `Multiple documents (${count} total)`;
		depth = count;
	}

	// Get actual size
	const actualSize = (getByteSize(output) / (1024 * 1024)).toFixed(2);
	const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);

	console.log(`Generated in ${generationTime}s`);
	console.log(`Actual size: ${actualSize}MB`);

	if (formatLower === 'json') {
		console.log(`Deepest path (depth ${depth}): ${deepestPathString}`);
	} else {
		console.log(`Total documents: ${depth}`);
	}

	// Save to file
	const fileName = `result_${targetSize}MB.${formatLower}`;
	writeFileSync(fileName, output, 'utf8');
	console.log(`File saved as: ${fileName}`);

	return {
		output: output,
		deepestPath: deepestPathString,
		depth: depth,
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
if (result.format === 'json') {
	console.log('Deepest path:', result.deepestPath);
} else {
	console.log('Document count:', result.depth);
}
