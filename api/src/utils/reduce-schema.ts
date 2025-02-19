import { uniq } from 'lodash';
import { SchemaOverview } from '../types';
import { PermissionsAction } from '@directus/shared/types';

/**
 * Reduces the schema based on the included permissions. The resulting object is the schema structure, but with only
 * the allowed collections/fields/relations included based on the permissions.
 * @param schema The full project schema
 * @param actions Array of permissions actions (crud)
 * @returns Reduced schema
 */
export function reduceSchema(
	schema: SchemaOverview,
	actions: PermissionsAction[] = ['create', 'read', 'update', 'delete']
): SchemaOverview {
	const reduced: SchemaOverview = {
		collections: {},
		relations: [],
		permissions: schema.permissions,
	};

	const allowedFieldsInCollection = schema.permissions
		.filter((permission) => actions.includes(permission.action))
		.reduce((acc, permission) => {
			if (!acc[permission.collection]) {
				acc[permission.collection] = [];
			}

			if (permission.fields) {
				acc[permission.collection] = uniq([...acc[permission.collection], ...permission.fields]);
			}

			return acc;
		}, {} as { [collection: string]: string[] });

	for (const [collectionName, collection] of Object.entries(schema.collections)) {
		if (
			schema.permissions.some(
				(permission) => permission.collection === collectionName && actions.includes(permission.action)
			)
		) {
			const fields: SchemaOverview['collections'][string]['fields'] = {};

			for (const [fieldName, field] of Object.entries(schema.collections[collectionName].fields)) {
				if (
					allowedFieldsInCollection[collectionName]?.includes('*') ||
					allowedFieldsInCollection[collectionName]?.includes(fieldName)
				) {
					fields[fieldName] = field;
				}
			}

			reduced.collections[collectionName] = {
				...collection,
				fields,
			};
		}
	}

	reduced.relations = schema.relations.filter((relation) => {
		let collectionsAllowed = true;
		let fieldsAllowed = true;

		if (Object.keys(allowedFieldsInCollection).includes(relation.collection) === false) {
			collectionsAllowed = false;
		}

		if (
			relation.related_collection &&
			Object.keys(allowedFieldsInCollection).includes(relation.related_collection) === false
		) {
			collectionsAllowed = false;
		}

		if (
			relation.meta?.one_allowed_collections &&
			relation.meta.one_allowed_collections.every((collection) =>
				Object.keys(allowedFieldsInCollection).includes(collection)
			) === false
		) {
			collectionsAllowed = false;
		}

		if (
			!allowedFieldsInCollection[relation.collection] ||
			(allowedFieldsInCollection[relation.collection].includes('*') === false &&
				allowedFieldsInCollection[relation.collection].includes(relation.field) === false)
		) {
			fieldsAllowed = false;
		}

		if (
			relation.related_collection &&
			relation.meta?.one_field &&
			(!allowedFieldsInCollection[relation.related_collection] ||
				(allowedFieldsInCollection[relation.related_collection].includes('*') === false &&
					allowedFieldsInCollection[relation.related_collection].includes(relation.meta?.one_field) === false))
		) {
			fieldsAllowed = false;
		}

		return collectionsAllowed && fieldsAllowed;
	});

	return reduced;
}
