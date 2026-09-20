import { StrictMode, useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { z } from 'zod';
import {
  defineComponent,
  StreamRenderer,
  getComponentDescriptions,
} from '../src';
import { getComponentDescriptions as getServerDescriptions } from '../src/server';
import type { StreamIssue } from '../src';

afterEach(cleanup);

describe('public API', () => {
  it('updates a chart in place and does not rerender it when only a sibling changes', () => {
    const mount = vi.fn();
    const unmount = vi.fn();
    const renders = vi.fn();
    const chart = defineComponent({
      name: 'line-chart',
      description: 'A line chart',
      schema: z.object({ data: z.array(z.number()).default([]) }),
      component: ({ data }) => {
        useEffect(() => {
          mount();
          return unmount;
        }, []);
        renders();
        return <output data-testid="chart">{data.join(',')}</output>;
      },
    });
    const components = [chart];
    let content = '<line-chart><data><item>1</item>';
    const view = render(
      <StreamRenderer components={components} content={content} streaming />,
    );
    const element = screen.getByTestId('chart');
    content += '<item>2</item></data></line-chart><p>End';
    view.rerender(
      <StreamRenderer components={components} content={content} streaming />,
    );
    expect(screen.getByTestId('chart')).toBe(element);
    expect(element.textContent).toBe('1,2');
    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();
    const count = renders.mock.calls.length;
    view.rerender(
      <StreamRenderer
        components={components}
        content={content + 'ing</p>'}
        streaming={false}
      />,
    );
    expect(renders).toHaveBeenCalledTimes(count);
  });

  it('renders static content on the server', () => {
    expect(
      renderToString(
        <StreamRenderer components={[]} content='<p class="intro">Hello</p>' />,
      ),
    ).toContain('<p class="intro">Hello</p>');
  });

  it('isolates malformed props and reports errors without removing surrounding content', () => {
    const onError = vi.fn();
    const card = defineComponent({
      name: 'test-card',
      description: 'Card',
      schema: z.object({ count: z.number() }),
      component: ({ count }) => <span>{count}</span>,
      fallback: <span>Unavailable</span>,
    });
    render(
      <StreamRenderer
        components={[card]}
        content="<p>Before</p><test-card><count>oops</count></test-card><p>After</p>"
        onError={onError}
      />,
    );
    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByText('After')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'invalid-props' }),
    );
  });

  it('isolates component render failures', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    const broken = defineComponent({
      name: 'broken-card',
      description: 'Broken',
      schema: z.object({}),
      component: () => {
        throw new Error('Broken component');
      },
      fallback: <p>Failed component</p>,
    });
    render(
      <StreamRenderer
        components={[broken]}
        content="<broken-card/><p>Still here</p>"
        onError={onError}
      />,
    );
    expect(screen.getByText('Still here')).toBeTruthy();
    expect(screen.getByText('Failed component')).toBeTruthy();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'component-error' }),
    );
    error.mockRestore();
  });

  it('reports an issue once when an inline listener updates parent state in Strict Mode', () => {
    const onError = vi.fn();
    function Consumer() {
      const [issues, setIssues] = useState<StreamIssue[]>([]);
      return (
        <>
          <output data-testid="issue-count">{issues.length}</output>
          <StreamRenderer
            components={[]}
            content="<unknown-card/>"
            onError={(issue) => {
              onError(issue);
              // Bound the original regression so a failure cannot hang the test runner.
              if (onError.mock.calls.length < 10)
                setIssues((previous) => [...previous, issue]);
            }}
          />
        </>
      );
    }
    render(
      <StrictMode>
        <Consumer />
      </StrictMode>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('issue-count').textContent).toBe('1');
  });

  it('uses the latest listener for new issues and reports again in a replaced document', () => {
    const first = vi.fn();
    const next = vi.fn();
    const components: [] = [];
    const content = '<unknown-card/>';
    const view = render(
      <StreamRenderer
        components={components}
        content={content}
        streaming
        onError={first}
      />,
    );
    expect(first).toHaveBeenCalledTimes(1);
    view.rerender(
      <StreamRenderer
        components={components}
        content={content}
        streaming
        onError={next}
      />,
    );
    expect(next).not.toHaveBeenCalled();
    view.rerender(
      <StreamRenderer
        components={components}
        content={content + '<other-card/>'}
        streaming
        onError={next}
      />,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ tag: 'other-card' }),
    );
    view.rerender(
      <StreamRenderer
        components={components}
        content={content}
        streaming
        onError={next}
      />,
    );
    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ tag: 'unknown-card' }),
    );
    expect(first).toHaveBeenCalledTimes(1);
  });

  it.each(['file', 'FiLe'])(
    'drops a non-empty %s input value and reports it without losing siblings',
    (type) => {
      const onError = vi.fn();
      const view = render(
        <StreamRenderer
          components={[]}
          content={`<p>Before</p><input TYPE="${type}" VALUE="test.txt"/><p>After</p>`}
          onError={onError}
        />,
      );
      expect(screen.getByText('Before')).toBeTruthy();
      expect(screen.getByText('After')).toBeTruthy();
      expect(view.container.querySelector('input')?.value).toBe('');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'invalid-attribute', tag: 'input' }),
      );
    },
  );

  it('preserves valid initial input values and checked state', () => {
    const onError = vi.fn();
    const view = render(
      <StreamRenderer
        components={[]}
        content='<input type="file" value=""/><input type="text" value="Hello"/><input type="checkbox" value="yes" checked="true"/>'
        onError={onError}
      />,
    );
    const [file, text, checkbox] = view.container.querySelectorAll('input');
    expect(file?.value).toBe('');
    expect(text?.value).toBe('Hello');
    expect(checkbox?.value).toBe('yes');
    expect(checkbox?.checked).toBe(true);
    expect(onError).not.toHaveBeenCalled();
  });

  it('filters executable tags and attributes while preserving ordinary CSS', () => {
    const view = render(
      <StreamRenderer
        components={[]}
        content='<div class="custom" style="color: red; --accent: blue"><script>alert(1)</script><a href="javascript:alert(1)" onclick="evil()">Link</a><img src="x" onerror="evil()"/></div>'
      />,
    );
    expect(view.container.querySelector('script')).toBeNull();
    expect(screen.getByText('Link').hasAttribute('href')).toBe(false);
    expect(screen.getByText('Link').hasAttribute('onclick')).toBe(false);
    expect(view.container.querySelector('img')?.hasAttribute('onerror')).toBe(
      false,
    );
    expect(
      view.container.querySelector('.custom')?.getAttribute('style'),
    ).toContain('color: red');
  });

  it('resets replaced content and works in Strict Mode', () => {
    const components: [] = [];
    const view = render(
      <StrictMode>
        <StreamRenderer components={components} content="<p>First" streaming />
      </StrictMode>,
    );
    view.rerender(
      <StrictMode>
        <StreamRenderer
          components={components}
          content="<p>First part</p>"
          streaming
        />
      </StrictMode>,
    );
    expect(screen.getByText('First part')).toBeTruthy();
    view.rerender(
      <StrictMode>
        <StreamRenderer components={components} content="<p>New</p>" />
      </StrictMode>,
    );
    expect(screen.queryByText('First part')).toBeNull();
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('generates descriptions from metadata without a React implementation', () => {
    const descriptions = getComponentDescriptions([
      {
        name: 'line-chart',
        description: 'Sales trend',
        schema: z.object({ title: z.string(), points: z.array(z.number()) }),
      },
    ]);
    expect(descriptions).toContain('Sales trend');
    expect(descriptions).toContain('item');
    expect(descriptions).toContain('"points"');
  });

  it('rejects duplicate component names and invalid custom tag names', () => {
    expect(() =>
      defineComponent({
        name: 'div',
        description: '',
        schema: z.object({}),
        component: () => null,
      }),
    ).toThrow();
    expect(() =>
      getServerDescriptions([
        {
          name: 'div',
          description: '',
          schema: z.object({}),
        },
      ]),
    ).toThrow('lowercase kebab-case');
    const definition = {
      name: 'test-card',
      description: '',
      schema: z.object({}),
    };
    expect(() => getComponentDescriptions([definition, definition])).toThrow(
      'Duplicate',
    );
  });

  it.each(['key', 'ref'])(
    'rejects top-level %s props in component definitions and server descriptions',
    (name) => {
      const definition = {
        name: 'test-card',
        description: '',
        schema: z.object({ [name]: z.string().optional() }),
      };
      const message = `React-reserved top-level prop "${name}"`;
      expect(() =>
        defineComponent({ ...definition, component: () => null }),
      ).toThrow(message);
      expect(() => getServerDescriptions([definition])).toThrow(message);
    },
  );

  it('streams nested key and ref fields without remounting the component', () => {
    const mount = vi.fn();
    const unmount = vi.fn();
    const definition = defineComponent({
      name: 'test-card',
      description: '',
      schema: z.object({
        data: z.object({ key: z.string(), ref: z.string() }),
      }),
      component: ({ data }) => {
        useEffect(() => {
          mount();
          return unmount;
        }, []);
        return (
          <output data-testid="nested-data">
            {data.key}:{data.ref}
          </output>
        );
      },
    });
    expect(getServerDescriptions([definition])).toContain('"key"');
    const components = [definition];
    const content = '<test-card><data><ref>r</ref><key>a';
    const view = render(
      <StreamRenderer components={components} content={content} streaming />,
    );
    const element = screen.getByTestId('nested-data');
    expect(element.textContent).toBe('a:r');
    view.rerender(
      <StreamRenderer
        components={components}
        content={content + 'b</key></data></test-card>'}
      />,
    );
    expect(screen.getByTestId('nested-data')).toBe(element);
    expect(element.textContent).toBe('ab:r');
    expect(mount).toHaveBeenCalledTimes(1);
    expect(unmount).not.toHaveBeenCalled();
  });
});
