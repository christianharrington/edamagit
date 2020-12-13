import { PullRequest } from './model/pullRequest';
import * as request from 'superagent';
import * as vscode from 'vscode';
import { ForgeState } from './model/forgeState';

const GITHUB_AUTH_PROVIDER_ID = 'github';
const SCOPES = ['repo'];

export async function getGithubForgeState(remoteUrl: string): Promise<ForgeState> {

  let cleaned = remoteUrl
    .replace(/.*github.com(\/|:)/, '')
    .replace('.git', '');

  const owner = cleaned.split('/').filter(Boolean)[0];
  const repo = cleaned.split('/').filter(Boolean)[1];

  let accessToken = await authenticate();

  let pullRequestsTask = getPullRequests(accessToken, owner, repo);

  return {
    forgeRemote: remoteUrl.toString(),
    pullRequests: await pullRequestsTask
  };
}

async function authenticate(): Promise<string> {

  const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: true });
  return session.accessToken;
}

async function getPullRequests(accessToken: string, owner: string, repo: string): Promise<PullRequest[]> {

  let res = await queryGithub(accessToken,
    {
      query:
        `query GetOpenPullRequests($owner: String!, $repo: String!) {
            repository(owner: $owner, name: $repo) {
              pullRequests(last:10, states: OPEN) {
                edges { node {
                  number
                  title
                  labels(last: 10) {
                    edges { node {
                      name
                      color
            }}}}}}}}`,
      variables: {
        owner,
        repo
      }
    }
  );

  return res.data.repository.pullRequests.edges.map((e: any) => ({
    id: e.node.number,
    title: e.node.title,
    labels: e.node.labels.edges.map((labelEdge: any) => ({
      name: labelEdge.node.name,
      color: labelEdge.node.color
    })
    ),
    remoteRef: `pull/${e.node.number}/head`
  }));

  return [];
}

async function queryGithub(accessToken: string, ql: object) {
  let res = await request
    .post('https://api.github.com/graphql')
    .set('Authorization', `Bearer ${accessToken}`)
    .set('User-Agent', 'edamagit')
    .send(ql);

  return JSON.parse(res.text);
}