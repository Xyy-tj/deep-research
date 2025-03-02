/**
 * @openapi
 * components:
 *   schemas:
 *     UserBalance:
 *       type: object
 *       properties:
 *         balance:
 *           type: integer
 *           description: User's credit balance
 *     UserDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *         username:
 *           type: string
 *           description: Username
 *         email:
 *           type: string
 *           format: email
 *           description: User's email
 *         credits:
 *           type: integer
 *           description: User's credit balance
 *     UserUpdateRequest:
 *       type: object
 *       properties:
 *         credits:
 *           type: integer
 *           description: Credits to add to the user
 */

/**
 * @openapi
 * tags:
 *   name: User
 *   description: User management API
 */

/**
 * @openapi
 * /api/user/balance:
 *   get:
 *     summary: Get user's credit balance
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User's credit balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserBalance'
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */

/**
 * @openapi
 * /api/user/{userId}:
 *   get:
 *     summary: Get user details
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserDetails'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create or update user
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdateRequest'
 *     responses:
 *       200:
 *         description: User created or updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserDetails'
 *       500:
 *         description: Server error
 */
