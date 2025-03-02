/**
 * @openapi
 * components:
 *   schemas:
 *     ResearchRequest:
 *       type: object
 *       required:
 *         - query
 *       properties:
 *         query:
 *           type: string
 *           description: The research query
 *         depth:
 *           type: integer
 *           description: The depth of the research
 *           default: 2
 *         breadth:
 *           type: integer
 *           description: The breadth of the research
 *           default: 4
 *         language:
 *           type: string
 *           description: The language for the research output
 *           default: zh-CN
 *     ResearchCostRequest:
 *       type: object
 *       properties:
 *         depth:
 *           type: integer
 *           description: The depth of the research
 *           default: 2
 *         breadth:
 *           type: integer
 *           description: The breadth of the research
 *           default: 4
 *     ResearchResponse:
 *       type: object
 *       properties:
 *         researchId:
 *           type: string
 *           description: The ID of the research session
 *     ResearchCostResponse:
 *       type: object
 *       properties:
 *         cost:
 *           type: integer
 *           description: The cost of the research in credits
 *     PartialResultsRequest:
 *       type: object
 *       properties:
 *         query:
 *           type: string
 *           description: The original research query
 *         language:
 *           type: string
 *           description: The language for the research output
 *           default: zh-CN
 *     PartialResultsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         report:
 *           type: string
 *           description: The partial research report
 *     AnswerRequest:
 *       type: object
 *       required:
 *         - answer
 *       properties:
 *         answer:
 *           type: string
 *           description: The answer to the question
 *     QuestionAnswerRequest:
 *       type: object
 *       required:
 *         - answer
 *         - questionId
 *       properties:
 *         answer:
 *           type: string
 *           description: The answer to the question
 *         questionId:
 *           type: string
 *           description: The ID of the question
 */

/**
 * @openapi
 * tags:
 *   name: Research
 *   description: Research API
 */

/**
 * @openapi
 * /api/research/cost:
 *   post:
 *     summary: Calculate the cost of a research query
 *     tags: [Research]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResearchCostRequest'
 *     responses:
 *       200:
 *         description: Research cost calculated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResearchCostResponse'
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
 * /api/research:
 *   post:
 *     summary: Start a new research
 *     tags: [Research]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResearchRequest'
 *     responses:
 *       200:
 *         description: Research started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResearchResponse'
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
 * /api/events/{researchId}:
 *   get:
 *     summary: Connect to event stream for research updates
 *     tags: [Research]
 *     parameters:
 *       - in: path
 *         name: researchId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the research session
 *     responses:
 *       200:
 *         description: Event stream connection established
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       404:
 *         description: Research session not found
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
 * /api/research/{id}/partial:
 *   post:
 *     summary: Get partial results for a research
 *     tags: [Research]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the research session
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PartialResultsRequest'
 *     responses:
 *       200:
 *         description: Partial results generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PartialResultsResponse'
 *       404:
 *         description: Research session not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /api/research/{id}/answer:
 *   post:
 *     summary: Submit an answer to a research question
 *     tags: [Research]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the research session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AnswerRequest'
 *     responses:
 *       200:
 *         description: Answer submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         description: Research session not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /api/answer/{researchId}:
 *   post:
 *     summary: Submit an answer to a specific question
 *     tags: [Research]
 *     parameters:
 *       - in: path
 *         name: researchId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the research session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionAnswerRequest'
 *     responses:
 *       200:
 *         description: Answer submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: No question waiting for answer
 *       404:
 *         description: Research session not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /api/save:
 *   post:
 *     summary: Save research results
 *     tags: [Research]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - researchId
 *             properties:
 *               researchId:
 *                 type: string
 *                 description: The ID of the research session
 *     responses:
 *       200:
 *         description: Research results saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 filename:
 *                   type: string
 *       404:
 *         description: Research session not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /api/markdown/{filename}:
 *   get:
 *     summary: Get markdown content
 *     tags: [Research]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: The filename of the markdown file
 *     responses:
 *       200:
 *         description: Markdown content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /api/download/{filename}:
 *   get:
 *     summary: Download markdown file
 *     tags: [Research]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: The filename of the markdown file
 *     responses:
 *       200:
 *         description: Markdown file
 *         content:
 *           text/markdown:
 *             schema:
 *               type: string
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /output/{filename}:
 *   get:
 *     summary: Get output file
 *     tags: [Research]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: The filename of the output file
 *       - in: query
 *         name: download
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Whether to download the file
 *     responses:
 *       200:
 *         description: Output file
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /api/research-list:
 *   get:
 *     summary: Get list of saved research results
 *     tags: [Research]
 *     responses:
 *       200:
 *         description: List of research results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       filename:
 *                         type: string
 *                       created:
 *                         type: string
 *                         format: date-time
 *                       size:
 *                         type: integer
 *       500:
 *         description: Server error
 */

/**
 * @openapi
 * /api/welcome-content:
 *   get:
 *     summary: Get welcome page content
 *     tags: [Research]
 *     responses:
 *       200:
 *         description: Welcome page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: string
 *       500:
 *         description: Server error
 */
